# OZONE Enterprise ERP — Master User Guide (English)

**Brand:** Syed Shoaib Ali Shah Bukhari (Bukharihub) • © 2026 All Rights Reserved

## 1. System Overview & Key Business Benefits

OZONE Enterprise ERP is a multi-company, multi-user ERP for diaper/FMCG distribution. It runs at **https://ozoneso.vercel.app** and through a Windows desktop wrapper that opens the same web app. Data is stored per company in Supabase Postgres, with custom 12-hour sessions, role permissions and row-level security.

The core document chain is strict:

`Sales Order → GDN / Gate Pass → Sales Tax Invoice → Bank Receipt → Customer Ledger & Reports`

### Problems it solves

- Paper vouchers, duplicate numbers and manual register errors.
- Finished-goods stock mismatches between orders, dispatch and invoices.
- Manual tax calculation errors (18% sales tax, 4% further tax, Section 236G).
- No clear view of customer dues, aging, bookers and bank accounts.
- Staff seeing prices, other companies' data or documents outside their role.
- Owners unable to control demo periods, licences, users and company access.

### Time-saving and accuracy benefits

- Atomic yearly voucher sequences per company; no duplicate numbers.
- Live FG stock: cartons and pieces move only when a GDN is posted.
- Sales orders auto-update to `PENDING`, `PARTIAL_DELIVERED` or `DELIVERED`.
- Automatic registered/unregistered tax calculation and amount-in-words.
- Receivables aging buckets: 0–30, 31–60, 61–90 and 90+ days.
- Print-ready A4 vouchers with company logo, bank details and signatures.
- Customer self-service portal for placing and tracking orders.
- Company isolation, hidden-rate accounts, entry locks and licence locks enforced in the database.

**Roles:** `SUPER_ADMIN`, `COMPANY_ADMIN`, `STORE_FG`, `ACCOUNTS`, `CUSTOMER`.

## 2. Getting Started & Access Guide

1. Open **https://ozoneso.vercel.app** in Chrome/Edge, or launch the **OZONE Enterprise ERP** desktop app (loads the same URL and requires internet).
2. If the desktop app shows the branded offline screen, check the connection and click **Retry Connection**.
3. Enter the **Company Code** (default demo company: `OZONE`). Company verification is automatic.
4. Enter your **Username** and **Password**, then click **Sign in**.
5. Sessions last 12 hours in the browser. Always click **Sign out** on shared computers.
6. `CUSTOMER` users land in the Customer Portal; other roles land on the Dashboard with a role-filtered sidebar.
7. Use **Change Password** in the header to update your own password (minimum 6 characters).

### First-time setup (Super Admin / Company Admin)

1. Administration → create users for Store, Accounts and customer contacts.
2. Products / FG Stock → add products with size, type, HS code, diapers/bag, bags/carton and opening cartons.
3. Customers → add customer master records with CNIC/NTN, STRN, registration/filer status, bank account and branch.
4. Administration → set logo, bank details and licence information (company profile is Super Admin only).
5. For a new company, Super Admin uses the company wizard, imports CSV data and downloads the desktop build config.

> Demo companies auto-lock 7 days after the demo start date. The login screen then shows the owner contact and WhatsApp link.

## 3. Role-by-Role Step-by-Step Operations Manual

### 3.1 SUPER_ADMIN — Master Owner

Full access to every company and module. Governance lives in **Administration → Super Admin — Company Master Control**:

1. **Suspend / Activate** a company.
2. **+7 Days** extends a demo; **Convert Full** removes demo mode.
3. **Factory Reset** requires typing the exact company code. It clears the master ledger, restores opening stock and resets voucher sequences while preserving customers, products, companies and users.
4. **New Company Setup & Template Wizard** creates a company, imports CSV master data, sets expiry and downloads build config.
5. Company profile, logo, licence dates and owner contact are Super Admin only.
6. Confidential founder documentation is available only through the owner-only in-app section and is never shown to other roles.

### 3.2 COMPANY_ADMIN — Company Manager

1. Create/edit users, assign roles, link customers to booker/customer logins, set permissions, hide rates or allow lock bypass.
2. Create customer logins from Customers and copy the WhatsApp credential message.
3. Use all voucher modules, products, customers, ledger, reports and printing.
4. Cannot modify company profile/logo or create another SUPER_ADMIN.

### 3.3 STORE_FG — Store / Finished Goods

1. Open **Sales Orders** and review pending cartons.
2. **GDN & Gate Pass → New GDN / Gate Pass**, select the SO, enter delivered cartons, vehicle, driver and remarks.
3. Click **Post GDN & Gate Pass**. Stock is deducted and SO status updates automatically.
4. Print the GDN/Gate Pass and hand it to dispatch.
5. A GDN cannot be deleted once an invoice exists.

### 3.4 ACCOUNTS — Accounts / Finance

1. **Sales Tax Invoices → New invoice**, choose an unbilled GDN, verify tax and generate the invoice.
2. **Bank Receipts → New receipt**, choose an unpaid invoice, enter amount/bank/reference and post.
3. **Customer Ledger** shows invoiced, received and balance by customer/booker; print as needed.
4. **Reports & Exports** provides aging, FG stock sheet, ledger CSV and full Excel export.

### 3.5 CUSTOMER / Distributor — Customer Portal

1. Log in with credentials shared by the administrator.
2. **Place New Order**: select a linked customer (registered first), enter cartons, use **Save & Next**.
3. Review the auto-grouped queue and click **Submit All Customer Orders**; each customer becomes a separate SO.
4. **Track My Orders** shows: Order Placed → Preparing / Partial Dispatch → Dispatched & On the Way → Invoiced & Completed.
5. Rates and amounts are hidden for customer accounts by design.

### 3.6 Daily document workflow

| Stage | Created by | Effect |
|---|---|---|
| Sales Order | COMPANY_ADMIN, SUPER_ADMIN, CUSTOMER (own linked customers) | Records ordered cartons; no stock change. |
| GDN / Gate Pass | STORE_FG, COMPANY_ADMIN, SUPER_ADMIN | Deducts stock; updates SO status. |
| Sales Tax Invoice | ACCOUNTS, COMPANY_ADMIN, SUPER_ADMIN | Calculates tax; posts receivable. |
| Bank Receipt | ACCOUNTS, COMPANY_ADMIN, SUPER_ADMIN | Posts payment; reduces balance. |

## 4. Reports, Analytics, Security Rules & FAQs

### Dashboard

- KPIs: total sales orders, total revenue, fulfilment rate, recovery rate.
- Monthly chart compares Sales Order Value vs Invoiced Revenue (PKR).
- Customer insights: repeat/active customers, average order value, registration segments.
- Status cards: Web Portal, Customer App, FG Inventory, Bank Ledger, Supabase Sync. **Offline** means that source failed to load.

### Reports & Exports

- **Ledger CSV** exports customer ledger rows.
- **Full Excel export** exports the company workbook.
- Aging applies receipts FIFO to invoices: 0–30, 31–60, 61–90, 90+ days.
- Ledger/report printouts are booker/agent-wise with bank details.

### Security and locking rules

- Company data is isolated; only SUPER_ADMIN sees all companies.
- Permissions control view/create/edit/delete/print; the database re-checks every mutation.
- Customer logins are linked to specific customers and can only create their sales orders.
- Vouchers older than 3 days, or on/before the entry lock date, are locked. Super Admin, Company Admin or bypass users can override.
- Downstream documents make records immutable: SO→GDN, GDN→Invoice, Invoice→Receipt.
- Sessions expire after 12 hours; licence/demo locks can block login.

### Common FAQs

| Problem | Action |
|---|---|
| `Auto-Locked (>3 Days)` | Ask Company Admin/Super Admin or a bypass user; do not change the date. |
| `Permission denied` | Ask the administrator to update your role permissions. |
| `Insufficient stock` | Reduce cartons or receive stock before dispatch. |
| Blank rates | Hidden rates are enabled for your account. |
| Demo expired | Contact the owner via the WhatsApp link on the lock screen. |
| Desktop offline screen | Check internet, then click **Retry Connection**. |
| Duplicate voucher fear | Numbering is atomic per company/year; never edit numbers manually. |

Engineered & Developed by Syed Shoaib Ali Shah Bukhari (Bukharihub) • © 2026 All Rights Reserved
