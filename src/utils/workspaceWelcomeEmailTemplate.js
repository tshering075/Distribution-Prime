import { PLATFORM_NAME } from '../constants/saas';

/**
 * @param {{ ownerName?: string, organizationName: string, authorizeUrl: string }} params
 */
export function buildWorkspaceWelcomeEmailHtml({ ownerName, organizationName, authorizeUrl }) {
  const greetingName = String(ownerName || '').trim() || 'there';
  const orgName = String(organizationName || '').trim() || 'your workspace';
  const safeAuthorizeUrl = String(authorizeUrl || '#');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to ${PLATFORM_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#0d47a1;color:#ffffff;padding:24px 28px;">
              <h1 style="margin:0;font-size:22px;font-weight:800;">Welcome to ${PLATFORM_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${greetingName},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                Congratulations — you have created your organization <strong>${orgName}</strong> on ${PLATFORM_NAME}.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                To send order emails from your admin account, connect Gmail once using the button below.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${safeAuthorizeUrl}" style="display:inline-block;background:#e40521;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;">
                  Authorize Gmail
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4b5563;">
                This link opens your workspace and signs you in with Google as the workspace owner. You only need to do this once per browser or device.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;word-break:break-all;">
                If the button does not work, copy and paste this URL into your browser:<br />
                <a href="${safeAuthorizeUrl}" style="color:#0d47a1;">${safeAuthorizeUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
              ${PLATFORM_NAME} — distribution management for bottlers and distributor networks.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * @param {{ organizationSlug: string, origin?: string, publicUrl?: string }} params
 */
export function buildWorkspaceGmailAuthorizeUrl({
  organizationSlug,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  publicUrl = process.env.PUBLIC_URL || '',
}) {
  const slug = String(organizationSlug || '').trim();
  const base = `${String(origin).replace(/\/$/, '')}${publicUrl}`;
  return `${base}/w/${encodeURIComponent(slug)}/connect-gmail`;
}
