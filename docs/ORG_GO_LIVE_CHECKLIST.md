# Organization Go-Live Checklist — Distribution Prime

Use this checklist before handing the app to a real organization. Complete items in order.

---

## A. Supabase database

- [ ] **Base schema exists** — `organizations`, `organization_members`, `distributors`, `admins`, `orders`, `sales_data`, `targets`, `schemes`, `app_config`
- [ ] Run all SQL scripts in order from [`supabase/production_run_order.sql`](../supabase/production_run_order.sql) (steps 1–20)
- [ ] Run [`supabase/audit_tenant_schema.sql`](../supabase/audit_tenant_schema.sql) — fix every row marked **MISSING** or **MISSING COLUMN**
- [ ] Confirm `distributors.physical_stock` column exists (step 8)
- [ ] Confirm `distributor_physical_stock_snapshots` table exists (step 9)
- [ ] Confirm `distributor_pos_sales` table exists if using POS (step 11)
- [ ] Insert platform admin UUID if operating multi-org SaaS:
  ```sql
  INSERT INTO platform_admins (user_id) VALUES ('your-auth-user-uuid');
  ```

---

## B. Environment & deploy

- [ ] Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in `.env` (local) and `wrangler.toml` `[vars]` (Cloudflare)
- [ ] `npm run build` succeeds (env check script passes)
- [ ] Deploy: `npm run deploy:cf`
- [ ] Workspace URL works: `https://your-domain/w/{workspace-slug}/login`

---

## C. Organization setup (first org)

- [ ] Create workspace via `/signup` or manual org insert + `workspace_signup_rpc.sql`
- [ ] Complete **Onboarding wizard**: workspace name, distributors, Rate Master products
- [ ] **User & Permissions**: create Admin, Viewer, Shipping users linked to `organization_id`
- [ ] **Distributors**: set codes and passwords (min 4 characters)
- [ ] **Targets**: set target period and distributor targets
- [ ] **Schemes** (if used): verify active date ranges
- [ ] **GST settings** (if used): org-level GST configuration

---

## D. End-to-end workflow test

Run once with a test distributor before real rollout.

| Step | Role | Action | Pass? |
|------|------|--------|-------|
| 1 | Distributor | Log in at `/w/{slug}/login`, place order | [ ] |
| 2 | Admin | Approve order | [ ] |
| 3 | Shipping | Open order, set MFG date + batch no., transport, save & dispatch | [ ] |
| 4 | Shipping | Print/save dispatch invoice — MFG/batch visible | [ ] |
| 5 | Distributor | Open **Physical stock** — primary sale + MFG/batch from dispatch | [ ] |
| 6 | Distributor | Enter physical stock qty, **Save stock** | [ ] |
| 7 | Admin | **Physical stock** overview — today's data visible | [ ] |
| 8 | Admin | **Reports** → Dispatch sales — filter, print invoice | [ ] |
| 9 | Admin | **Reports** → Performance / SKU export (Excel/PDF) | [ ] |
| 10 | Distributor | **POS sale** (if used) — sale saves and syncs | [ ] |

---

## E. Multi-user verification

- [ ] Second browser / device: distributor sees same orders after refresh
- [ ] Admin and shipping see dispatched order status
- [ ] Physical stock saved on device A appears for admin on device B (after save)

---

## F. Optional features

| Feature | Requirement |
|---------|-------------|
| Gmail order approval | OAuth configured in Admin settings |
| Historical physical stock Excel | `distributor_physical_stock_snapshots` + distributors saving stock |
| POS cross-device sync | `add_distributor_pos_sales.sql` applied |
| Dispatch invoice numbers | `add_order_invoice_number.sql` applied |

---

## G. Before production deploy (engineering)

- [ ] Commit and test all pending app changes (reports, physical stock, shipping)
- [ ] Remove or rotate Supabase keys if `wrangler.toml` is shared publicly
- [ ] Share [`docs/Distribution-Prime-Organization-SOP.md`](./Distribution-Prime-Organization-SOP.md) with org staff

---

## H. Support contacts

| Issue | Check |
|-------|--------|
| Distributor cannot log in | Password set in Admin → Distributors; run `add_distributor_credentials.sql` |
| Rate Master won't save | Run `fix_rls_function_grants.sql`, `fix_app_config_tenant_pkey.sql` |
| Dispatch fails | Run `add_shipping_order_columns.sql` |
| Physical stock not syncing | Run steps 8–9 in production run order |
| POS not syncing | Run steps 10–11 |
| Reports empty | Orders must be **dispatched**; check `sales_data` / achievement applied |

---

**Sign-off**

| Role | Name | Date |
|------|------|------|
| Technical lead | | |
| Organization admin | | |
