import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_PRICE_ENV: Record<string, string> = {
  pro: 'STRIPE_PRICE_PRO',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecret || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Billing is not configured on the server (missing Stripe or Supabase secrets).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const organizationId = String(body?.organizationId || '').trim();
    const planId = String(body?.planId || '').trim().toLowerCase();
    const successUrl = String(body?.successUrl || '').trim();
    const cancelUrl = String(body?.cancelUrl || '').trim();

    if (!organizationId || !planId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'organizationId, planId, successUrl, and cancelUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!PLAN_PRICE_ENV[planId]) {
      return new Response(JSON.stringify({ error: 'Invalid plan. Use pro or enterprise.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = Deno.env.get(PLAN_PRICE_ENV[planId]);
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price not configured for plan: ${planId}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, slug, name, stripe_customer_id, billing_email')
      .eq('id', organizationId)
      .limit(1);

    if (orgError || !org?.length) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organization = org[0];
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userData.user.id)
      .limit(1);

    const { data: adminRow } = await supabaseAdmin
      .from('admins')
      .select('uid')
      .eq('organization_id', organizationId)
      .eq('uid', userData.user.id)
      .limit(1);

    if (!membership?.length && !adminRow?.length) {
      return new Response(JSON.stringify({ error: 'You are not a member of this workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
    let customerId = organization.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: organization.billing_email || userData.user.email || undefined,
        name: organization.name,
        metadata: { organization_id: organizationId, organization_slug: organization.slug },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId, billing_email: userData.user.email })
        .eq('id', organizationId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: organizationId,
      metadata: { organization_id: organizationId, plan_id: planId },
      subscription_data: {
        metadata: { organization_id: organizationId, plan_id: planId },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('stripe-checkout error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Checkout failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
