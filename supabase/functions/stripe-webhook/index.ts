import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';

Deno.serve(async (req) => {
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response('Server not configured', { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId =
        session.metadata?.organization_id || session.client_reference_id || '';
      const planId = session.metadata?.plan_id || 'pro';

      if (organizationId) {
        await supabase
          .from('organizations')
          .update({
            plan: planId,
            stripe_subscription_id: String(session.subscription || ''),
            plan_updated_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', organizationId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const organizationId = sub.metadata?.organization_id;
      if (organizationId) {
        await supabase
          .from('organizations')
          .update({
            plan: 'trial',
            stripe_subscription_id: null,
            plan_updated_at: new Date().toISOString(),
          })
          .eq('id', organizationId);
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
    return new Response('Webhook handler failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
