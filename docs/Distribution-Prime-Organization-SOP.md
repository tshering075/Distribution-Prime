# Distribution Prime — Organization Standard Operating Procedure (SOP)

---

## 1. Document overview

### 1.1 Purpose

This Standard Operating Procedure (SOP) defines the **official operating standards** for organizations using **Distribution Prime** to manage beverage distribution. It ensures that all staff and distributors follow the same processes for:

- Workspace setup and user onboarding  
- Product, pricing, target, and scheme configuration  
- Order placement, approval, and dispatch  
- Stock reporting, performance tracking, and audit  

Each organization should adopt this document (or adapt it to local policy) and distribute the relevant sections to Admin, Shipping, Viewer, and Distributor users.

### 1.2 Intended audience

| Audience | Sections to read |
|----------|------------------|
| Organization owner / Admin | All sections |
| Viewer (read-only staff) | Sections 1–3, 5, 6.1, 6.5–6.6, 9–11 |
| Shipping staff | Sections 1–3, 5, 8, 9–11, Appendix C |
| Distributor | Sections 1–3, 5, 7, 9–11, Appendix C |

### 1.3 Scope

**In scope**

| # | Area | Details |
|---|------|---------|
| 1 | Organization setup | Sign-up, workspace profile, distributor and staff onboarding |
| 2 | Master data | Product & Rate Master, targets, schemes, GST |
| 3 | Order workflow | Place → review → approve/reject → dispatch |
| 4 | Shipping | Invoice upload, transport details, dispatch confirmation |
| 5 | Stock & reporting | Physical stock, stock lifting, performance reports, activity log |
| 6 | Email approval | Optional Gmail-based management sign-off |

**Out of scope**

- Platform administration (managed by Distribution Prime operators)  
- Custom software development or third-party integrations  
- Business processes outside the distribution workflow described here  

### 1.4 Definitions and abbreviations

| Term | Meaning |
|------|---------|
| **Workspace** | Your organization’s isolated account; all data is scoped to one company |
| **Workspace ID** | Short login identifier for your organization (lowercase letters, numbers, hyphens) |
| **PC** | Physical Case — case count by category (CSD PC, Water PC); CAN excluded from PC totals |
| **UC** | Unit Case — normalized volume: `(cases × UC multiplier) ÷ UC divisor` |
| **CSD / Water / CAN** | Product categories in Rate Master |
| **Stock lifting** | Sales volume recorded automatically when an order is dispatched |
| **Physical stock** | Distributor-reported on-hand inventory by SKU and MFG date |
| **Dispatched** | Final shipment status in the application (stored internally as delivered) |

---

## 2. System access

### 2.1 Application URLs

| Purpose | URL |
|---------|-----|
| Branded login (recommended) | `https://distribution-prime.pages.dev/w/{workspace-id}/login` |
| General login | `https://distribution-prime.pages.dev/login` |
| New organization sign-up | `https://distribution-prime.pages.dev/signup` |
| Admin dashboard | `https://distribution-prime.pages.dev/admin` |
| Shipping dashboard | `https://distribution-prime.pages.dev/shipping` |
| Distributor dashboard | `https://distribution-prime.pages.dev/distributor` |
| Privacy Policy | `https://distribution-prime.pages.dev/legal/privacy-policy` |
| Terms of Service | `https://distribution-prime.pages.dev/legal/terms-of-service` |

### 2.2 Sign-in credentials by role

| Role | Workspace ID | Login identifier | Password |
|------|:------------:|------------------|----------|
| Admin | Required | **Email address** | Account password (min. 8 characters at sign-up) |
| Viewer | Required | **Email address** | Same as Admin |
| Shipping | Required | **Email address** | Account password |
| Distributor | Required | **Distributor code** (not email) | Password set by Admin (min. 4 characters) |

**Organization rule:** Every user in your organization must use the **same Workspace ID**. Do not share passwords between users.

### 2.3 Supported regions (distributor assignment)

Organizations typically assign distributors to one of these regions (configurable in Admin):

| Region |
|--------|
| Southern |
| Western |
| Eastern |
| PLING |
| THIM |

---

## 3. Roles, responsibilities, and authority

### 3.1 Role descriptions

| Role | Typical job title | Dashboard | Primary duties |
|------|-------------------|-----------|----------------|
| **Admin** | Operations manager, head office | Admin (`/admin`) | Configure workspace, approve orders, manage targets/rates/schemes, manage users and distributors |
| **Viewer** | Finance, audit, regional manager | Admin (`/admin`, read-only) | View dashboards and reports; cannot change data |
| **Shipping** | Warehouse / logistics staff | Shipping (`/shipping`) | Upload invoices, enter transport details, mark orders Dispatched |
| **Distributor** | Authorized depot operator | Distributor (`/distributor`) | Place orders, view targets/prices, submit physical stock |

### 3.2 Responsibility matrix (RACI summary)

| Activity | Admin | Viewer | Shipping | Distributor |
|----------|:-----:|:------:|:--------:|:-----------:|
| Configure company profile | R/A | I | I | I |
| Add / edit distributors | R/A | I | — | — |
| Maintain Product & Rate Master | R/A | I | — | — |
| Set targets and schemes | R/A | I | — | — |
| Approve or reject orders | R/A | I | — | — |
| Send email for approval | R/A | — | — | — |
| View performance reports | R | R | — | — |
| Upload shipping invoice | — | — | R/A | I |
| Enter transport details | — | — | R/A | — |
| Mark order Dispatched | — | — | R/A | I |
| Place orders | — | — | — | R/A |
| Cancel own pending order | — | — | — | R/A |
| Submit physical stock | — | — | — | R/A |
| View product prices | R | R | — | R |

*R = Responsible, A = Accountable, I = Informed*

### 3.3 Approval authority (organization policy)

Your organization must document locally:

| Policy item | Recommended standard |
|-------------|---------------------|
| Who may approve orders | Admin role holders only |
| Email approval required? | Optional — configure in Gmail Settings |
| Response SLA for pending orders | **48 hours** (application default) |
| Who may delete orders | Admin only, per written policy |
| Who may reject orders | Admin or email approver (if Gmail enabled) |

---

## 4. Organization onboarding (one-time setup)

Complete this section before go-live. Use **Appendix A** as a sign-off checklist.

### 4.1 Step 1 — Register the organization

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Navigate to `/signup` | Sign-up form opens |
| 2 | Enter **Company name** | Legal or trading name recorded |
| 3 | Enter **Workspace ID** (lowercase, numbers, hyphens only) | Unique login identifier created |
| 4 | Enter owner **name**, **email**, **password** (min. 8 characters) | Owner account created |
| 5 | Submit sign-up | Redirect to Admin dashboard with onboarding wizard |
| 6 | Record branded login URL | `https://distribution-prime.pages.dev/w/{workspace-id}/login` |

### 4.2 Step 2 — Configure company profile

**Navigation:** Admin sidebar → **Workspace** (under Workspace group)

| Field | Required | Purpose |
|-------|:--------:|---------|
| Company name | Yes | Display name on invoices and reports |
| Address | Yes | Letterhead and invoice address |
| Post no. | Optional | Postal code |
| GST no. | Optional | Tax registration |
| Theme color | Optional | Brand color on invoices/letterhead |

**Action:** Copy and distribute the **workspace login URL** to all staff and distributors.

### 4.3 Step 3 — Register distributors

**Navigation:** Admin sidebar → **Distributors** (under Operations)

| Field | Required | Rules |
|-------|:--------:|-------|
| Code | Yes | 2–20 alphanumeric characters; used as login ID; must be unique |
| Name | Yes | Distributor display name |
| Region | Yes | Southern, Western, Eastern, PLING, or THIM |
| Username | Yes | 3–30 characters (letters, numbers, underscore) |
| Password | Yes (new) | Min. 4 characters |
| Contact / phone | Optional | Valid local phone format if provided |

**Bulk onboarding:** Use **Import** to add many distributors at once.

**Credential handout (per distributor):** Provide securely:

1. Workspace ID  
2. Distributor code  
3. Password  
4. Branded login URL  

### 4.4 Step 4 — Product & Rate Master

**Navigation:** Admin sidebar → **Product & Rate Master**

| Field | Description |
|-------|-------------|
| SKU | Product stock-keeping unit code |
| Product name | Display name |
| Category | **CSD**, **Water**, or **CAN** |
| Rate | Price per case |
| kg/case | Weight per case (for tonnage) |
| UC multiplier | Used in UC calculation |

**UC divisor:** Default **5.678**. Adjust only if your organization’s volume policy requires it.

### 4.5 Step 5 — Sales targets

**Navigation:** Admin sidebar → **Targets**

| Step | Action |
|------|--------|
| 1 | Set **target period** start and end dates (applies organization-wide) |
| 2 | For each distributor, enter **CSD PC**, **CSD UC**, **Water PC**, **Water UC** targets |
| 3 | Save targets before distributors begin ordering |

**Achievement rule:** CSD and Water UC targets are evaluated together; surplus in one category may offset shortfall in the other.

### 4.6 Step 6 — Schemes & discounts (optional)

**Navigation:** Admin sidebar → **Scheme & Discount**

| Scheme type | Description |
|-------------|-------------|
| Free cases | Buy X cases, get Y cases free |
| Percentage discount | Fixed discount amount per case |

Set scope by **SKU** or **category**, and define **valid from / to** dates.

### 4.7 Step 7 — GST settings (optional)

**Navigation:** Admin sidebar → **GST Settings**

Configure GST enabled/disabled by default, by region, or per distributor per your tax policy.

### 4.8 Step 8 — Internal staff accounts

| Method | Navigation | Use when |
|--------|------------|----------|
| Invite link | **Team & invites** | Inviting Admin, Viewer, or Shipping by email |
| Direct create | **User & Permissions** | Creating or removing accounts; assigning roles |

**Rule:** Invitees must sign in with the **exact email address** that received the invite.

### 4.9 Step 9 — Gmail approval (optional)

**Navigation:** Admin sidebar → **Gmail Settings**

| Step | Action |
|------|--------|
| 1 | Enter **Gmail Client ID** and **API Key** from your Google Cloud project |
| 2 | Complete OAuth consent in browser |
| 3 | Test by sending an order for email approval |

Used for **Send Email for Approval** and automatic status updates from reply keywords (*approve*, *reject*).

---

## 5. Order lifecycle

### 5.1 Status flow diagram

```
PENDING ──► SENT ──► APPROVED ──► DISPATCHED (complete)
   │           │
   │           └──► EMAIL FAILED ──► (retry or manual approve)
   │
   ├──► CANCELED (distributor, Pending/Sent only)
   └──► REJECTED (admin or email approver)
```

### 5.2 Status reference table

| Status (UI label) | Meaning | Valid next actions | Accountable role |
|-------------------|---------|-------------------|------------------|
| **Pending** | Distributor submitted; awaiting review | Send email, Approve, Reject, Cancel, Delete | Admin |
| **Sent** | Approval email dispatched | Approve, Reject, Cancel | Admin / email approver |
| **Email Failed** | Email could not be sent | Retry email, Approve, Reject, Cancel | Admin |
| **Approved** | Authorized for shipment | Dispatch (after invoice + transport) | Shipping |
| **Rejected** | Not approved | None (terminal) | Admin |
| **Canceled** | Withdrawn by distributor | None (terminal) | Distributor |
| **Dispatched** | Shipment complete | None (terminal) | Shipping |

### 5.3 Automatic system actions on dispatch

When Shipping marks an order **Dispatched**, the system automatically:

1. Updates distributor **achievement** (PC and UC vs targets)  
2. Creates **stock lifting** records in sales data  
3. Makes uploaded **shipping invoice(s)** available to the distributor  
4. Records the action in the **Activity** log  

### 5.4 Order cancellation rules

| Current status | Distributor can cancel? | Admin can delete? |
|----------------|:-----------------------:|:-----------------:|
| Pending | Yes | Per policy |
| Sent | Yes | Per policy |
| Email Failed | Yes | Per policy |
| Approved | No | Per policy |
| Dispatched | No | No |
| Rejected / Canceled | No | No |

---

## 6. Admin — standard operating procedure

### 6.1 Admin menu reference

| Group | Menu item | Function |
|-------|-----------|----------|
| Operations | Dashboard | Performance overview, regional/distributor sales vs targets |
| Operations | Orders | Review, approve, reject, email orders |
| Operations | Calculator | Admin order calculator (same engine as distributor) |
| Operations | Targets | Set target period and distributor targets |
| Operations | Scheme & Discount | Create and manage promotions |
| Operations | Product & Rate Master | Maintain SKU catalog and rates |
| Operations | Physical Stock | Review distributor stock submissions |
| Operations | Stock lifting records | View/export dispatch-based sales data |
| Operations | Distributors | Add, edit, import distributors |
| Operations | Reports | Performance and SKU reports (PDF/Excel) |
| Operations | Activity | Audit trail |
| Operations | Gmail Settings | Email approval configuration |
| Operations | GST Settings | Tax policy |
| Workspace | Workspace | Company profile and login URL |
| Workspace | Team & invites | Staff invite links |
| Workspace | User & Permissions | Account and role management |

### 6.2 Daily procedure — Admin

| # | Task | Procedure | Frequency |
|---|------|-----------|-----------|
| 1 | Sign in | Open branded login URL → email + password → Admin dashboard | Daily |
| 2 | Review performance | Dashboard → check regional/distributor achievement vs targets | Daily |
| 3 | Process orders | Orders → Pending / Sent / Email Failed tabs → act on each order | Daily |
| 4 | Physical stock | Physical Stock → review new submissions (badge indicates updates) | Daily |
| 5 | Activity review | Activity → check for errors or unexpected changes | Daily |
| 6 | Reports | Reports → generate weekly/monthly exports as required | Weekly |

### 6.3 Order processing — detailed steps

**Navigation:** Admin sidebar → **Orders**

| Step | Action | Detail |
|------|--------|--------|
| 1 | Open order | Click order row to view line items, schemes, PC, UC, amounts |
| 2 | Verify | Confirm distributor, region, quantities, and scheme application |
| 3a | Email approval (optional) | Click **Send Email for Approval** → status becomes **Sent** |
| 3b | Direct approval | Click **Approve** → status becomes **Approved** → Shipping queue |
| 3c | Rejection | Click **Reject** → add reason if prompted → status **Rejected** |
| 4 | Follow-up | If Sent and no reply within **48 hours**, approve/reject manually or resend email |
| 5 | Delete | Only when authorized; removes order from active queue |

### 6.4 Physical stock oversight

| Step | Action |
|------|--------|
| 1 | Admin sidebar → **Physical Stock** |
| 2 | Filter by distributor or region |
| 3 | Review SKU quantities and MFG dates submitted by distributors |
| 4 | Reconcile against orders and field inventory per organization policy |

### 6.5 Reporting and exports

| Report type | Source data | Export formats |
|-------------|-------------|----------------|
| Performance | Dispatched orders vs targets | PDF, Excel |
| SKU detail | Stock lifting / dispatch records | PDF, Excel |
| Stock lifting records | Filter by region, date, distributor | In-app table + export |

---

## 7. Distributor — standard operating procedure

### 7.1 Distributor navigation

| Screen | Path | Function |
|--------|------|----------|
| Home | Bottom nav → Home | Target balance, period, stock lifting summary |
| Place Order | Bottom nav → Place Order | Submit new order |
| Orders | Bottom nav → Orders | Track and cancel orders |
| Prices | Bottom nav → Prices | Read-only rate list |
| Stock | Bottom nav → Stock | Submit physical inventory |

### 7.2 Sign-in procedure

| Step | Action |
|------|--------|
| 1 | Open organization branded login URL |
| 2 | Enter **Workspace ID** (if not pre-filled) |
| 3 | Enter **distributor code** and **password** |
| 4 | Use **Remember me** only on trusted personal devices |

### 7.3 Order placement — detailed steps

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Review Home dashboard | Check target balance (CSD/Water PC & UC) and days remaining |
| 2 | Open **Place Order** | Product list loads from Rate Master |
| 3 | Enter **cases** per SKU | Schemes apply automatically where eligible |
| 4 | Review totals | Confirm PC, UC, amounts, free cases/discounts |
| 5 | Submit order | Status = **Pending**; appears under **Orders** |
| 6 | Confirm notification | Order visible to Admin in Orders queue |

### 7.4 Post-submission management

| Status | Distributor action available |
|--------|------------------------------|
| Pending | View, **Cancel** |
| Sent | View, **Cancel** |
| Approved | View only; await dispatch |
| Dispatched | View; download **shipping invoice** |
| Rejected / Canceled | View only |

### 7.5 Physical stock submission

| Step | Action |
|------|--------|
| 1 | Bottom nav → **Stock** |
| 2 | Enter quantity per **SKU** and **MFG date** |
| 3 | **Save** |
| 4 | Data syncs to Admin → **Physical Stock** |

---

## 8. Shipping — standard operating procedure

### 8.1 Shipping dashboard tabs

| Tab | Content | Action required |
|-----|---------|-----------------|
| Awaiting approval | Pending / Sent orders (informational) | None — monitor only |
| Approved | Orders ready to ship | **Process these** |
| Dispatched | Completed shipments | Reference / audit |

### 8.2 Dispatch procedure — mandatory sequence

**Do not skip steps.** The system blocks dispatch until all requirements are met.

| Step | Requirement | Details |
|------|-------------|---------|
| 1 | Order status = **Approved** | Confirm in Approved tab |
| 2 | Upload **shipping invoice** | PDF or image; multiple files allowed |
| 3 | Select **transporter / vehicle ownership** | Company vehicle, Distributor Vehicle, Private vehicle, or Hired vehicle |
| 4 | Select **vehicle type** | Jumbo, DCM, or custom type added by workspace |
| 5 | Enter **vehicle number** | Valid Bhutan format (e.g. BP-1-A1234) |
| 6 | Enter **transportation charges** | Numeric amount (optional but recommended) |
| 7 | Verify order line items | Preview calculated table |
| 8 | Click **Dispatch** | Status → **Dispatched** |

### 8.3 Bhutan vehicle number format

| Component | Values |
|-----------|--------|
| Plate prefix | **BP** (private), **BT** (taxi), **BG** (government), **BHT** (heavy/commercial) |
| Region digit | **1** Western, **2** Central, **3** Southern, **4** Eastern |
| Format | `{PREFIX}-{REGION}-{LETTER}{4 DIGITS}` e.g. **BP-1-A1234** |

### 8.4 Dispatch validation errors

| Error message | Resolution |
|---------------|------------|
| Missing transporter vehicle | Select from transporter dropdown |
| Missing vehicle type | Select Jumbo, DCM, or custom type |
| Invalid vehicle number | Enter valid Bhutan plate format |
| Missing invoice | Upload at least one invoice file before Dispatch |

### 8.5 Post-dispatch verification

| Check | Expected result |
|-------|-----------------|
| Order moves to **Dispatched** tab | Yes |
| Distributor can view invoice | Yes |
| Distributor target achievement updates | Yes (on Home dashboard) |
| Stock lifting record created | Yes (visible in Admin → Stock lifting records) |
| Activity log entry | Yes (Admin → Activity) |

---

## 9. Security and data governance

### 9.1 Credential policy

| Rule | Requirement |
|------|-------------|
| Unique accounts | One login per person; no shared credentials |
| Password storage | Issue passwords securely; do not send in plain email if avoidable |
| Distributor passwords | Admin resets via **Distributors** menu |
| Staff passwords | Reset via **User & Permissions** |
| Session on shared PCs | Sign out after use; avoid Remember me on shared devices |

### 9.2 Data isolation

- All users must sign in to the **correct Workspace ID** for your organization.  
- Data from other organizations is never visible.  
- Remove staff access and deactivate distributors promptly when employment ends.

### 9.3 Email integration (if enabled)

Gmail is used **only** for order approval emails and reply detection. See Privacy Policy for data handling details.

---

## 10. Troubleshooting guide

| # | Symptom | Likely cause | Resolution |
|---|---------|--------------|------------|
| 1 | Distributor cannot sign in | Wrong code or password | Admin verifies credentials in **Distributors**; reset password |
| 2 | Admin/Shipping cannot sign in | Wrong email or password | Reset via **User & Permissions** |
| 3 | Wrong company data shown | Incorrect Workspace ID | Sign out; use correct branded login URL |
| 4 | Shipping cannot dispatch | Order not Approved | Admin must approve first |
| 5 | Dispatch button disabled | Missing invoice or transport | Upload invoice; complete all transport fields |
| 6 | Invalid vehicle number | Wrong plate format | Use BP/BT/BG/BHT format with region 1–4 |
| 7 | Order not in shipping list | Wrong workspace or status | Refresh; confirm Approved status and Workspace ID |
| 8 | Email approval not working | Gmail not configured or unclear reply | Check Gmail Settings; approver must use clear approve/reject wording |
| 9 | Targets not updating | Order not dispatched or wrong period | Confirm Dispatched status; verify target period dates |
| 10 | Scheme not applied | Quantity below threshold or expired scheme | Check scheme rules and valid dates |

**Application support:** codewynbuild@gmail.com

---

## 11. Document control

| Version | Date | Author | Summary of changes |
|---------|------|--------|-------------------|
| 1.0 | March 2025 | Distribution Prime | Initial SOP |
| 2.0 | March 2025 | Distribution Prime | Organization-focused revision |
| 3.0 | March 2025 | Distribution Prime | Detailed structured SOP with field-level procedures |

| Item | Value |
|------|-------|
| Prepared for | Organizations using Distribution Prime |
| Review cycle | Annually, or when major features/workflows change |
| Distribution | Issue to all Admin, Shipping, and Distributor users |

---

## Appendix A — Organization go-live checklist

| # | Task | Done | Date | Initials |
|---|------|:----:|------|----------|
| 1 | Organization registered; Workspace ID recorded | ☐ | | |
| 2 | Company profile completed (name, address, GST, theme) | ☐ | | |
| 3 | Branded login URL documented and shared | ☐ | | |
| 4 | All distributors added; credentials issued securely | ☐ | | |
| 5 | Product & Rate Master populated | ☐ | | |
| 6 | Target period and per-distributor targets set | ☐ | | |
| 7 | Schemes configured (if applicable) | ☐ | | |
| 8 | GST settings configured (if applicable) | ☐ | | |
| 9 | Admin, Viewer, and Shipping accounts created | ☐ | | |
| 10 | Gmail approval configured and tested (if applicable) | ☐ | | |
| 11 | Staff trained on Sections 6, 7, or 8 per role | ☐ | | |
| 12 | Document owner and review date recorded on cover | ☐ | | |

**Go-live authorized by:** _________________________ **Date:** _____________

---

## Appendix B — Admin daily checklist

| # | Task | Done |
|---|------|:----:|
| 1 | Sign in to Admin dashboard | ☐ |
| 2 | Review Orders → Pending / Sent / Email Failed | ☐ |
| 3 | Approve, reject, or email orders per policy | ☐ |
| 4 | Review Physical Stock for new submissions | ☐ |
| 5 | Check Activity log for overnight issues | ☐ |
| 6 | Export reports if due (weekly/monthly) | ☐ |

---

## Appendix C — Distributor daily checklist

| # | Task | Done |
|---|------|:----:|
| 1 | Sign in with code and Workspace ID | ☐ |
| 2 | Review target balance on Home | ☐ |
| 3 | Place order via Place Order (if ordering today) | ☐ |
| 4 | Confirm order status under Orders | ☐ |
| 5 | Update Physical stock if required by policy | ☐ |
| 6 | Download invoice when order is Dispatched | ☐ |

---

## Appendix D — Shipping daily checklist

| # | Task | Done |
|---|------|:----:|
| 1 | Sign in to Shipping dashboard | ☐ |
| 2 | Open **Approved** tab | ☐ |
| 3 | For each order: upload invoice | ☐ |
| 4 | Enter transporter, vehicle type, vehicle no., charges | ☐ |
| 5 | Click **Dispatch** | ☐ |
| 6 | Confirm order appears under **Dispatched** | ☐ |

---

*End of document*
