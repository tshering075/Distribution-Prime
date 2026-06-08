# Distribution Prime — Standard Operating Procedure (SOP)

**Document version:** 1.0  
**Effective date:** March 2025  
**Application URL:** https://distribution-prime.pages.dev  
**Product:** Distribution Prime (multi-tenant distribution management)

---

## 1. Purpose

This SOP describes how to operate **Distribution Prime** for beverage distribution teams: workspace setup, daily use by Admin, Distributor, and Shipping staff, and the end-to-end **order → approval → dispatch** workflow.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| Workspace login, roles, and dashboards | Supabase / Cloudflare server administration |
| Orders, targets, rates, schemes, stock | Custom code changes |
| Shipping invoices and dispatch | Platform operator console (unless you are a platform admin) |
| Gmail-based approval (optional) | |

---

## 3. Roles and access

| Role | How to sign in | Dashboard | Primary responsibility |
|------|----------------|-----------|------------------------|
| **Admin** | Workspace ID + **admin email** + password | `/admin` | Configure workspace, approve orders, set targets/rates/schemes, manage users |
| **Viewer** | Same as admin | `/admin` | View dashboards and reports (read-only intent) |
| **Shipping** | Workspace ID + **shipping email** + password | `/shipping` | Upload invoices, enter transport details, mark orders **Dispatched** |
| **Distributor** | Workspace ID + **distributor code** + password | `/distributor` | Place orders, view targets/prices, submit physical stock |
| **Platform admin** | Email at `/platform/login` | `/platform` | Manage all customer workspaces (internal operators only) |

### 3.1 Sign-in URLs

| URL | Use |
|-----|-----|
| `https://distribution-prime.pages.dev/login` | General sign-in (enter Workspace ID manually) |
| `https://distribution-prime.pages.dev/w/{workspace-id}/login` | Branded sign-in for one company |
| `https://distribution-prime.pages.dev/signup` | Create a new company workspace |

**Workspace ID** = your company’s short sign-in name (lowercase letters, numbers, hyphens; e.g. `acme-beverages`).

---

## 4. Initial workspace setup (Admin — one time)

Perform these steps after **Sign up** or when onboarding a new company.

### 4.1 Create workspace (owner)

1. Open **Sign up** (`/signup`).
2. Enter **Company name**, **Workspace ID**, owner **name**, **email**, and **password** (min. 8 characters).
3. Complete sign-up → you land on **Admin dashboard** with an onboarding wizard.
4. Share the workspace login link with staff:  
   `https://distribution-prime.pages.dev/w/{workspace-id}/login`

### 4.2 Workspace settings

1. Admin sidebar → **Workspace**.
2. Set **company name**, **address**, **post no.**, **GST no.**, and **theme color** (used on invoices/letterhead).
3. Copy and save the **workspace login URL** for distributors and staff.

### 4.3 Add distributors

1. Admin sidebar → **Distributors**.
2. **Add distributor**: code (login ID), name, region, contact details, and **password** (stored on distributor record).
3. Optionally **import** distributors in bulk.
4. Give each distributor their **code**, **password**, **Workspace ID**, and login URL.

### 4.4 Product & Rate Master

1. Admin sidebar → **Product & Rate Master**.
2. Add/edit products: SKU, name, category (**CSD**, **Water**, **CAN**), rate, kg/case, UC multiplier.
3. Confirm **UC divisor** (default **5.678**) if your policy requires adjustment.

### 4.5 Targets

1. Admin sidebar → **Targets**.
2. Set **target period** (start/end dates) — applies globally unless overridden per distributor.
3. Enter **CSD** and **Water** targets in **PC** and **UC** per distributor (or by region as configured).

### 4.6 Schemes & discounts (optional)

1. Admin sidebar → **Scheme & Discount**.
2. Create schemes: free cases (buy X get Y) or percentage discount; scope by SKU or category; set valid dates.

### 4.7 GST settings (optional)

1. Admin sidebar → **GST Settings**.
2. Enable/disable GST by default, region, or per distributor as required.

### 4.8 Team & staff accounts

1. **Team & invites** — send invite links for **Admin**, **Viewer**, or **Shipping** (invitee must sign in with invited email).
2. **User & Permissions** — create or remove staff accounts and assign roles.

### 4.9 Gmail settings (optional — for email approval)

1. Admin sidebar → **Gmail Settings**.
2. Enter **Gmail Client ID** and **API Key** (from Google Cloud Console).
3. Complete OAuth consent in the browser when prompted.
4. Used for **Send Email for Approval** and automatic approve/reject from email replies.

---

## 5. Order lifecycle (all roles)

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────────┐
│  PENDING    │ ──► │ SENT /       │ ──► │ APPROVED │ ──► │ DISPATCHED  │
│ (placed)    │     │ EMAIL FAILED │     │          │     │ (delivered) │
└─────────────┘     └──────────────┘     └──────────┘     └─────────────┘
       │                    │                  │
       ▼                    ▼                  ▼
   CANCELED            REJECTED           (terminal)
   (distributor)       (admin/Gmail)
```

| Status (system) | What users see | Who acts next |
|-----------------|----------------|---------------|
| **Pending** | Pending | Admin reviews or sends approval email |
| **Sent** | Sent | GM replies or admin approves/rejects |
| **Email Failed** | Email Failed | Admin retries email or approves manually |
| **Approved** | Approved | Shipping uploads invoice and dispatches |
| **Rejected** | Rejected | End — distributor notified |
| **Canceled** | Canceled | End — distributor canceled (from pending/sent only) |
| **Delivered** | **Dispatched** | End — sales/stock lift recorded |

**On dispatch:** distributor **achievement** (PC/UC) updates and **stock lifting** records are created automatically.

---

## 6. Admin — daily operating procedure

### 6.1 Monitor dashboard

1. Sign in → **Admin dashboard**.
2. Review **Performance** view: regional/distributor sales vs targets.
3. Check **Orders** badge for orders needing action.

### 6.2 Process pending orders

1. Open **Orders** (sidebar or summary strip).
2. Tab: **Pending** (and **Sent** / **Email Failed** if applicable).
3. For each order:
   - **View** calculated lines (quantities, schemes, amounts).
   - **Send Email for Approval** (optional) — sends order image/details to configured recipients; status → **Sent**.
   - **Approve** — status → **Approved** (shipping can dispatch).
   - **Reject** — status → **Rejected** (add reason if prompted).
   - **Delete** — only if policy allows and order should be removed.

### 6.3 Gmail auto-approval (if enabled)

- After **Send Email**, the system may read Gmail replies for keywords (*approve*, *reject*, etc.) and update status automatically.
- Admin should still verify **Orders** queue if no reply within **48 hours** (default SLA).

### 6.4 Physical stock review

1. Sidebar → **Physical Stock**.
2. Review distributor submissions (badge = new updates).
3. Use for reconciliation vs orders and field stock.

### 6.5 Stock lifting records

1. Sidebar → **Stock lifting records**.
2. Filter by region/date/distributor.
3. Export or drill into SKU detail for reporting.

### 6.6 Reports

1. Sidebar → **Reports**.
2. Generate performance or SKU reports from **dispatched** order data.
3. Export **PDF** or **Excel** as needed.

### 6.7 Activity log

- Sidebar → **Activity** — audit trail of significant actions (approvals, dispatches, config changes).

---

## 7. Distributor — daily operating procedure

### 7.1 Sign in

1. Open workspace login URL (or main login with **Workspace ID**).
2. Enter **distributor code** (not email) and **password**.
3. **Remember me** optional — session may persist after closing browser.

### 7.2 Home dashboard

- Review **target balance** (CSD/Water PC & UC: target vs achieved vs remaining).
- Check **target period** and days remaining.
- Review **stock lifting records** (updates when orders are dispatched).

### 7.3 Place an order

1. Bottom nav → **Place Order** (or **Calculator**).
2. Select products, enter **cases**; schemes may apply automatically.
3. Review totals (PC, UC, amounts).
4. **Submit** → order status **Pending**; admin is notified.

### 7.4 Manage orders

1. Bottom nav → **Orders**.
2. View status: Pending, Approved, Dispatched, etc.
3. **Cancel** only while status is Pending or Sent (if allowed).
4. When **Dispatched**: download/view **shipping invoice** if uploaded.

### 7.5 Product prices

- Bottom nav → **Prices** — read-only rate list from Rate Master.

### 7.6 Physical stock

1. Bottom nav → **Stock**.
2. Enter quantities by **SKU** and **MFG date**.
3. **Save** — data syncs to admin **Physical Stock** view.

---

## 8. Shipping — daily operating procedure

### 8.1 Sign in

1. Use **workspace login URL** with **shipping staff email** and password.
2. Must have active workspace context (same **Workspace ID** as company).

### 8.2 Work the approved queue

1. Open **Shipping dashboard**.
2. Filter tabs: **Awaiting approval** (informational) / **Approved** / **Dispatched**.
3. Focus on **Approved** orders ready to ship.

### 8.3 Dispatch checklist (per order)

Complete **all** steps before marking **Dispatched**:

| Step | Action |
|------|--------|
| 1 | Confirm order is **Approved** |
| 2 | **Upload shipping invoice** (PDF/image; multiple files allowed) |
| 3 | Enter **transport details**: transporter, vehicle type, **vehicle no.** (Bhutan format), transport charges |
| 4 | Preview order table if needed |
| 5 | Click **Dispatch** (Dispatched) |

**Result:** status → **Dispatched**; distributor achievement and stock lifting update; distributor can download invoice.

### 8.4 If invoice or transport is missing

- System blocks dispatch until **invoice uploaded** and **transport fields complete**.
- Fix data and retry **Dispatch**.

---

## 9. Key terms (glossary)

| Term | Definition |
|------|------------|
| **PC (Physical Case)** | Case count by category (CSD PC, Water PC). CAN products excluded from PC totals. |
| **UC (Unit Case)** | Normalized volume: `(cases × UC multiplier) ÷ UC divisor`. Used for target achievement. |
| **CSD / Water / CAN** | Product categories in Rate Master. |
| **Target period** | Date range for measuring distributor targets. |
| **Stock lifting** | Sales volume recorded when shipping **dispatches** an order (`sales_data`). |
| **Physical stock** | Distributor-reported on-hand inventory (SKU × MFG date), separate from PC achievement. |
| **Scheme** | Promotion: free cases or % discount on qualifying products. |
| **Dispatched** | UI label for completed shipment; stored as `delivered` in database. |
| **Workspace** | Isolated company tenant; all data scoped to one organization. |

**Target achievement policy:** Combined UC — CSD and Water UC targets evaluated together; surplus in one category may offset shortfall in the other (per app rules).

---

## 10. Troubleshooting

| Issue | Check |
|-------|--------|
| **Workspace ID field missing on login** | Site must be built with Supabase env vars; redeploy if needed. |
| **Wrong password — distributor** | Password must match credentials on distributor row; admin resets in **Distributors**. |
| **Wrong password — admin/shipping** | Use Supabase Auth password; reset via admin **User & Permissions** or Supabase. |
| **Shipping cannot dispatch** | Order must be **Approved**; invoice uploaded; transport fields complete. |
| **Order not in shipping list** | Refresh; confirm same **workspace** and order status. |
| **Gmail approval not working** | Verify Gmail Settings, OAuth token, and recipient replied with clear approve/reject wording. |
| **Targets not updating** | Dispatch must complete; check target period dates and product categories. |
| **Privacy / OAuth verification** | Use `https://distribution-prime.pages.dev/privacy-policy.html` (not homepage URL) in Google Cloud Console. |

**Support contact:** codewynbuild@gmail.com

---

## 11. Security and data handling

- Do not share distributor codes/passwords between users.
- Admin and shipping use **email + password**; distributors use **code + password**.
- Sign out on shared computers (Admin/Shipping: session-based; Distributor: may persist if “Remember me” used).
- Gmail integration: used only for order approval emails and reply detection (see Privacy Policy).
- Each workspace’s data is isolated; users must sign in to the correct **Workspace ID**.

---

## 12. Document control

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | March 2025 | Initial SOP for Distribution Prime |

**Prepared for:** Distribution Prime operators (Admin, Shipping, Distributor)  
**Review cycle:** Update when major features or workflows change.

---

## Appendix A — Quick reference cards

### Admin — morning checklist

- [ ] Sign in to `/admin`
- [ ] Check **Orders** → Pending / Sent
- [ ] Approve or email orders as per GM process
- [ ] Review **Physical Stock** updates
- [ ] Check **Activity** for overnight errors

### Distributor — order day

- [ ] Sign in with code + workspace ID
- [ ] Check target balance on Home
- [ ] Place order via **Place Order**
- [ ] Confirm order appears under **Orders** as Pending
- [ ] Update **Physical stock** if required by policy

### Shipping — dispatch day

- [ ] Sign in to `/shipping`
- [ ] Open **Approved** tab
- [ ] For each shipment: invoice → transport → **Dispatch**
- [ ] Confirm order moves to **Dispatched**
