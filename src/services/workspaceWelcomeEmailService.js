import { supabase } from '../supabase';
import {
  buildWorkspaceGmailAuthorizeUrl,
  buildWorkspaceWelcomeEmailHtml,
} from '../utils/workspaceWelcomeEmailTemplate';
import { PLATFORM_NAME } from '../constants/saas';

function isMissingFunctionError(error) {
  const msg = String(error?.message || '');
  return (
    error?.name === 'FunctionsFetchError' ||
    /function.*not found/i.test(msg) ||
    /failed to send a request to the edge function/i.test(msg)
  );
}

/**
 * Send the workspace owner a welcome email with a Gmail authorize link.
 * Requires the Supabase Edge Function `workspace-welcome-email` and platform Gmail sender secrets.
 * Non-fatal: returns { sent: false } when the function is not deployed or not configured.
 *
 * @param {{
 *   organizationId: string,
 *   organizationName: string,
 *   organizationSlug: string,
 *   ownerEmail: string,
 *   ownerName?: string,
 * }} params
 */
export async function sendWorkspaceWelcomeEmail({
  organizationId,
  organizationName,
  organizationSlug,
  ownerEmail,
  ownerName,
}) {
  if (!supabase) {
    console.warn('Supabase not configured; skipping workspace welcome email');
    return { sent: false, reason: 'supabase_not_configured' };
  }

  const authorizeUrl = buildWorkspaceGmailAuthorizeUrl({ organizationSlug });
  const htmlBody = buildWorkspaceWelcomeEmailHtml({
    ownerName,
    organizationName,
    authorizeUrl,
  });
  const subject = `Welcome to ${PLATFORM_NAME} — ${organizationName}`;

  try {
    const { data, error } = await supabase.functions.invoke('workspace-welcome-email', {
      body: {
        organizationId,
        organizationName,
        organizationSlug,
        ownerEmail,
        ownerName: ownerName || '',
        authorizeUrl,
        subject,
        htmlBody,
      },
    });

    if (error) {
      if (isMissingFunctionError(error)) {
        console.warn('workspace-welcome-email edge function is not deployed; skipping welcome email');
        return { sent: false, reason: 'function_not_deployed' };
      }
      throw error;
    }

    if (data?.error) {
      if (/not configured/i.test(String(data.error))) {
        console.warn('Workspace welcome email sender is not configured:', data.error);
        return { sent: false, reason: 'sender_not_configured' };
      }
      throw new Error(String(data.error));
    }

    return { sent: Boolean(data?.sent), messageId: data?.messageId || null };
  } catch (err) {
    console.warn('Workspace welcome email failed (non-fatal):', err?.message || err);
    return { sent: false, reason: err?.message || 'send_failed' };
  }
}
