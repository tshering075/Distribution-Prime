# Google OAuth consent screen verification

Deploy target: **https://cokesales-management-system.pages.dev/**

## Privacy policy URL (important)

Cloudflare **redirects** root paths like `/privacy-policy.html` with **308** to `/privacy-policy`. Google’s checker treats that as improperly formatted.

**In Google Cloud Console → OAuth consent screen, set Privacy policy to:**

```
https://cokesales-management-system.pages.dev/privacy-policy
```

**Do not use** `.../privacy-policy.html` unless you have deployed with `html_handling = "none"` in `wrangler.toml` and confirmed:

```powershell
curl -sI https://cokesales-management-system.pages.dev/privacy-policy.html
```

Must show `HTTP/1.1 200`, not `308`.

**Backup URL** (returns 200 with `.html` today, no redirect):

```
https://cokesales-management-system.pages.dev/legal/privacy-policy.html
```

## 1. Home page ownership (Search Console)

1. [Google Search Console](https://search.google.com/search-console) → **URL prefix**: `https://cokesales-management-system.pages.dev/`
2. Verify with **HTML tag**; paste token into `public/index.html` and `public/privacy-policy.html`
3. Deploy → **Verify**

## 2. OAuth consent screen fields

| Field | Value |
|--------|--------|
| App name | `CokeSales Management System` |
| Application home page | `https://cokesales-management-system.pages.dev/` |
| Privacy policy | `https://cokesales-management-system.pages.dev/privacy-policy` |
| App logo | Upload `public/oauth-app-logo.png` (same artwork as the app; regenerate with `scripts/resize-brand-logos.ps1`) |

Home page must link to the **same** privacy policy URL as the consent screen.

## 3. Deploy

```bash
npm run build
npx wrangler deploy
```

## 4. Resubmit

OAuth consent screen → **Prepare for verification** → **Submit for verification**

## Checklist

- [ ] Privacy policy URL is `/privacy-policy` (200, full HTML, no redirect)
- [ ] Home page links to `/privacy-policy`
- [ ] Search Console verified for pages.dev
- [ ] App name matches site: **CokeSales Management System**
- [ ] Logo is `public/oauth-app-logo.png` (120×120 resize of your master logo)
