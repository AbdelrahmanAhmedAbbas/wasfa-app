import { wasfaColors } from "../../lib/theme/wasfa.ts";

type WelcomeRecipient = { email: string; name: string | null };

const LOGO_URL = "https://www.wasfa.life/brand/logo-1.png";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

/** Transactional welcome email sent after a user's first onboarding profile save. */
export function welcomeEmail(recipient: WelcomeRecipient, from: string) {
  const firstName = recipient.name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return {
    from,
    to: [recipient.email.trim().toLowerCase()],
    subject: "Welcome to Wasfa | أهلاً بك في وصفة",
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${wasfaColors.background};font-family:Arial,sans-serif;color:${wasfaColors.ink}">
  <div style="display:none;max-height:0;overflow:hidden">Your recipe collection starts here. أهلاً بك في وصفة!</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${wasfaColors.background}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${wasfaColors.surface};border:1px solid ${wasfaColors.line};border-radius:22px;overflow:hidden">
        <tr><td style="height:6px;background:${wasfaColors.cta};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td align="center" style="padding:28px 24px 24px;background:${wasfaColors.primarySoft}">
          <img src="${LOGO_URL}" width="184" height="90" alt="Wasfa" style="display:block;width:184px;height:auto;border:0;max-width:100%">
        </td></tr>
        <tr><td style="padding:30px 32px 12px">
          <p style="margin:0 0 10px;color:${wasfaColors.primaryDark};font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Your recipe home</p>
          <h1 style="margin:0 0 20px;color:${wasfaColors.ink};font-size:28px;line-height:1.25">Welcome to Wasfa</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.6">Your recipe collection starts here. Share a recipe from Instagram, TikTok, or YouTube to Wasfa, then add it to your meal plan and grocery list.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${wasfaColors.soft};border:1px solid ${wasfaColors.line};border-radius:14px">
            <tr><td style="padding:18px 20px;color:${wasfaColors.primaryDark};font-size:15px;line-height:1.6;font-weight:bold">Save a recipe&nbsp;&nbsp;→&nbsp;&nbsp;Plan meals&nbsp;&nbsp;→&nbsp;&nbsp;Shop easily</td></tr>
          </table>
          <p lang="ar" dir="rtl" style="margin:24px 0 0;font-size:16px;line-height:1.9;text-align:right">أهلاً بك في وصفة! شارك وصفة من إنستغرام أو تيك توك أو يوتيوب إلى التطبيق، ثم أضفها إلى خطة وجباتك وقائمة التسوق.</p>
        </td></tr>
        <tr><td style="padding:18px 32px 30px;color:${wasfaColors.muted};font-size:14px;line-height:1.6">Happy cooking,<br><strong style="color:${wasfaColors.primaryDark}">The Wasfa team</strong></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${greeting}\n\nWelcome to Wasfa! Share a recipe from Instagram, TikTok, or YouTube to Wasfa, then add it to your meal plan and grocery list.\n\nأهلاً بك في وصفة! شارك وصفة من إنستغرام أو تيك توك أو يوتيوب إلى التطبيق، ثم أضفها إلى خطة وجباتك وقائمة التسوق.\n\nHappy cooking,\nThe Wasfa team`,
  };
}
