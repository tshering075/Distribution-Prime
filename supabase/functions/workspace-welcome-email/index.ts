import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGmailAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || 'Failed to refresh Gmail access token');
  }
  if (!payload.access_token) {
    throw new Error('Gmail token response missing access_token');
  }
  return payload.access_token as string;
}

async function sendGmailHtml({
  accessToken,
  fromEmail,
  toEmail,
  subject,
  htmlBody,
}: {
  accessToken: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
}) {
  const message = [
    `From: ${fromEmail}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64UrlEncode(message) }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Gmail API send failed');
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const clientId = Deno.env.get('PLATFORM_GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('PLATFORM_GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('PLATFORM_GMAIL_REFRESH_TOKEN');
    const senderEmail = Deno.env.get('PLATFORM_GMAIL_SENDER_EMAIL');

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Supabase server secrets are missing.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
      return new Response(
        JSON.stringify({
          error:
            'Platform welcome email sender is not configured. Set PLATFORM_GMAIL_CLIENT_ID, PLATFORM_GMAIL_CLIENT_SECRET, PLATFORM_GMAIL_REFRESH_TOKEN, and PLATFORM_GMAIL_SENDER_EMAIL in Supabase Edge Function secrets.',
          sent: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const ownerEmail = String(body?.ownerEmail || '').trim().toLowerCase();
    const organizationName = String(body?.organizationName || '').trim();
    const organizationSlug = String(body?.organizationSlug || '').trim();
    const ownerName = String(body?.ownerName || '').trim();
    const authorizeUrl = String(body?.authorizeUrl || '').trim();
    const subject = String(body?.subject || `Welcome — ${organizationName}`).trim();
    const htmlBody = String(body?.htmlBody || '').trim();

    if (!organizationId || !ownerEmail || !organizationName || !organizationSlug || !authorizeUrl || !htmlBody) {
      return new Response(JSON.stringify({ error: 'Missing required welcome email fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userEmail = String(userData.user.email || '').trim().toLowerCase();
    if (userEmail !== ownerEmail) {
      return new Response(JSON.stringify({ error: 'You can only request a welcome email for your own account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const { data: adminRow } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('uid', userData.user.id)
      .maybeSingle();

    if (!membership && !adminRow) {
      return new Response(JSON.stringify({ error: 'You are not a member of this workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getGmailAccessToken(clientId, clientSecret, refreshToken);
    const sendResult = await sendGmailHtml({
      accessToken,
      fromEmail: senderEmail,
      toEmail: ownerEmail,
      subject,
      htmlBody,
    });

    return new Response(
      JSON.stringify({
        sent: true,
        messageId: sendResult?.id || null,
        ownerName,
        organizationSlug,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('workspace-welcome-email failed:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to send welcome email', sent: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
