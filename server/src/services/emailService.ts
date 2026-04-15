import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function baseTemplate(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#534AB7;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">PurchaseVault</h1>
              <p style="margin:8px 0 0;color:#c5c0f0;font-size:14px;">Your purchase &amp; warranty archive</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f7;padding:24px 40px;text-align:center;border-top:1px solid #e8e8ec;">
              <p style="margin:0;color:#9b9b9b;font-size:12px;">
                You are receiving this email because you have notifications enabled in PurchaseVault.<br/>
                To unsubscribe, log in and disable notifications in your profile settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function productTableRows(
  products: Array<{ name: string; expiryDate: string; daysRemaining?: number }>
): string {
  return products
    .map(
      (p) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f4;font-size:14px;color:#333333;">${p.name}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #f0f0f4;font-size:14px;color:#333333;">${p.expiryDate}</td>
      ${
        p.daysRemaining !== undefined
          ? `<td style="padding:12px 16px;border-bottom:1px solid #f0f0f4;font-size:14px;color:#f59e0b;font-weight:600;">${p.daysRemaining} day${p.daysRemaining === 1 ? '' : 's'}</td>`
          : ''
      }
    </tr>`
    )
    .join('');
}

export async function sendExpiringWarrantyEmail(
  to: string,
  products: Array<{ name: string; expiryDate: string; daysRemaining: number }>
): Promise<void> {
  const bodyContent = `
    <h2 style="margin:0 0 8px;color:#534AB7;font-size:22px;">Warranties Expiring Soon</h2>
    <p style="margin:0 0 24px;color:#666666;font-size:15px;line-height:1.6;">
      The following warranties are expiring within the next 30 days. Log in to PurchaseVault to review your coverage and take action.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e8e8ec;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background-color:#f9f9fb;">
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e8e8ec;">Product</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e8e8ec;">Expiry Date</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e8e8ec;">Days Left</th>
        </tr>
      </thead>
      <tbody>
        ${productTableRows(products)}
      </tbody>
    </table>
    <p style="margin:24px 0 0;color:#666666;font-size:14px;line-height:1.6;">
      Don't let your warranties lapse — consider renewing or replacing before the expiry date.
    </p>`;

  await transporter.sendMail({
    from: `"PurchaseVault" <${process.env.SMTP_USER}>`,
    to,
    subject: `⚠️ ${products.length} Warrant${products.length === 1 ? 'y' : 'ies'} Expiring Soon`,
    html: baseTemplate('Warranties Expiring Soon', bodyContent),
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const bodyContent = `
    <h2 style="margin:0 0 8px;color:#534AB7;font-size:22px;">Reset Your Password</h2>
    <p style="margin:0 0 24px;color:#666666;font-size:15px;line-height:1.6;">
      We received a request to reset the password for your PurchaseVault account. Click the button below to choose a new password.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${resetUrl}"
         style="display:inline-block;background-color:#534AB7;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 8px;color:#999999;font-size:13px;line-height:1.6;">
      This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.
    </p>
    <p style="margin:0;color:#bbbbbb;font-size:12px;word-break:break-all;">
      Or copy this link: ${resetUrl}
    </p>`;

  await transporter.sendMail({
    from: `"PurchaseVault" <${process.env.SMTP_USER}>`,
    to,
    subject: '🔑 Reset Your PurchaseVault Password',
    html: baseTemplate('Reset Your Password', bodyContent),
  });
}

export async function sendProductSharedEmail(
  to: string,
  ownerName: string,
  productName: string,
  permission: string,
  loginUrl: string,
): Promise<void> {
  const permLabel = permission === 'edit' ? 'view and edit' : 'view';
  const bodyContent = `
    <h2 style="margin:0 0 8px;color:#534AB7;font-size:22px;">A Product Has Been Shared With You</h2>
    <p style="margin:0 0 24px;color:#666666;font-size:15px;line-height:1.6;">
      <strong>${ownerName}</strong> has shared <strong>${productName}</strong> with you on PurchaseVault.
      You have permission to <strong>${permLabel}</strong> this product.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${loginUrl}"
         style="display:inline-block;background-color:#534AB7;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600;">
        View in PurchaseVault
      </a>
    </div>
    <p style="margin:0;color:#999999;font-size:13px;line-height:1.6;">
      Log in to your PurchaseVault account to view the shared product.
    </p>`;

  await transporter.sendMail({
    from: `"PurchaseVault" <${process.env.SMTP_USER}>`,
    to,
    subject: `📦 ${ownerName} shared "${productName}" with you`,
    html: baseTemplate('Shared Product', bodyContent),
  });
}

export async function sendExpiredWarrantyEmail(
  to: string,
  products: Array<{ name: string; expiryDate: string }>
): Promise<void> {
  const bodyContent = `
    <h2 style="margin:0 0 8px;color:#ef4444;font-size:22px;">Warranties Have Expired</h2>
    <p style="margin:0 0 24px;color:#666666;font-size:15px;line-height:1.6;">
      The following warranties expired today. Log in to PurchaseVault to update your records.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e8e8ec;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background-color:#f9f9fb;">
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e8e8ec;">Product</th>
          <th style="padding:12px 16px;text-align:left;font-size:12px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e8e8ec;">Expired On</th>
        </tr>
      </thead>
      <tbody>
        ${productTableRows(products)}
      </tbody>
    </table>
    <p style="margin:24px 0 0;color:#666666;font-size:14px;line-height:1.6;">
      These items are no longer under warranty. Consider purchasing extended coverage or replacing them if needed.
    </p>`;

  await transporter.sendMail({
    from: `"PurchaseVault" <${process.env.SMTP_USER}>`,
    to,
    subject: `🔴 ${products.length} Warrant${products.length === 1 ? 'y' : 'ies'} Expired Today`,
    html: baseTemplate('Warranties Expired', bodyContent),
  });
}
