import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { insertRow, updateRow, upsertRow } from '../lib/api'
import { exportSheets } from '../lib/excel'
import { dateTimeLabel, titleCase } from '../lib/format'
import { addDays, daysUntil, formatDateInput, LICENSE_DAYS, SUPPORT_CONTACT } from '../lib/license'
import { isPlatformMaster, isPlatformMasterUser } from '../lib/rbac'
import type { Row } from '../lib/types'

const ROLES = [
  'master',
  'super_user',
  'registered_user',
  'unregistered_user',
  'sales_approver',
  'delivery',
  'gate',
  'billing',
  'bank',
  'super_admin',
  'platform_master',
]

const POLICY_KEYS = [
  'can_edit_vouchers',
  'can_delete_vouchers',
  'can_print_vouchers',
  'can_view_rates',
  'can_view_values',
  'can_view_full_invoices',
  'can_upload_fg_excel',
  'can_view_stock',
  'can_approve_orders',
  'can_post_gdn',
  'can_issue_gate_pass',
  'can_create_invoice',
  'can_post_receipt',
  'can_manage_users',
  'can_manage_products',
  'can_manage_company',
]

type AdminTab = 'users' | 'policies' | 'company' | 'licenses' | 'builder'

const randomCnic = (): string => {
  const part = (length: number) => Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)).toString()
  return `${part(5)}-${part(7)}-${Math.floor(Math.random() * 10)}`
}

const licenseTone = (value: any): 'green' | 'amber' | 'red' => {
  const remaining = daysUntil(value)
  if (remaining === null || remaining < 0) return 'red'
  if (remaining <= 7) return 'amber'
  return 'green'
}

const licenseLabel = (value: any): string => {
  const remaining = daysUntil(value)
  if (remaining === null) return 'Not set'
  if (remaining < 0) return 'Expired'
  if (remaining === 0) return 'Expires today'
  return `${remaining} Days Left`
}

export const AdminPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const master = isPlatformMaster(session)
  const users = useRows('users', { order: 'full_name' })
  const policies = useRows('user_policies', {})
  const companies = useRows('companies', { order: 'company_code' })
  const settings = useRows('company_settings', {})
  const [tab, setTab] = useState<AdminTab>('users')
  const [userOpen, setUserOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [error, setError] = useState('')
  const [newUser, setNewUser] = useState<Row>({
    cnic: randomCnic(),
    login_id: '',
    password: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'master',
    customer_id: '',
  })
  const [companyForm, setCompanyForm] = useState<Row | null>(null)
  const [licenseDrafts, setLicenseDrafts] = useState<Record<string, Row>>({})
  const [buildDates, setBuildDates] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState('')

  const policyByUser = useMemo(() => new Map(policies.rows.map((policy) => [policy.user_id, policy])), [policies.rows])
  const visibleUsers = useMemo(
    () => users.rows.filter((row) => master || !isPlatformMasterUser(row)),
    [users.rows, master],
  )
  const company = companies.rows.find((row) => row.company_id === session.company.company_id) || session.company
  const companySettings = settings.rows[0] || session.settings
  const visibleCompanies = master ? companies.rows : companies.rows.filter((row) => row.company_id === company.company_id)
  const activeTab: AdminTab = !master && (tab === 'policies' || tab === 'licenses' || tab === 'builder') ? 'users' : tab

  const licenseDraft = (row: Row): Row => ({
    license_expiry_date:
      licenseDrafts[row.company_id]?.license_expiry_date ??
      formatDateInput(row.license_expiry_date) ??
      addDays(row.created_at, LICENSE_DAYS),
    license_status: licenseDrafts[row.company_id]?.license_status ?? row.license_status ?? 'active',
    support_contact: licenseDrafts[row.company_id]?.support_contact ?? row.support_contact ?? SUPPORT_CONTACT,
  })

  const saveLicense = async (row: Row) => {
    const draft = licenseDraft(row)
    try {
      await updateRow('companies', row.company_id, {
        license_expiry_date: draft.license_expiry_date,
        license_status: draft.license_status,
        support_contact: draft.support_contact,
      })
      notify(`${row.company_code} license updated`)
      await companies.reload()
      refresh()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to update license', 'error')
    }
  }

  const extendLicense = async (row: Row, days: number) => {
    const draft = licenseDraft(row)
    setLicenseDrafts({ ...licenseDrafts, [row.company_id]: { ...draft, license_expiry_date: addDays(draft.license_expiry_date, days) } })
    try {
      await updateRow('companies', row.company_id, {
        license_expiry_date: addDays(draft.license_expiry_date, days),
        license_status: 'active',
      })
      notify(`${row.company_code} license extended by ${days} days`)
      await companies.reload()
      refresh()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to extend license', 'error')
    }
  }

  const buildCommand = (code: string, expiry: string) =>
    `npm run electron:build:company -- --company=${code} --expiry=${expiry}`

  const envConfig = (row: Row, expiry: string) =>
    [
      `VITE_LOCKED_COMPANY_CODE=${row.company_code}`,
      `VITE_LOCKED_COMPANY_NAME=${row.company_name}`,
      `VITE_LOCKED_EXPIRY_DATE=${expiry}`,
      `VITE_SUPABASE_URL=${import.meta.env.VITE_SUPABASE_URL || ''}`,
      `VITE_SUPABASE_ANON_KEY=${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
    ].join('\n')

  const copyBuildCommand = async (row: Row) => {
    const expiry = buildDates[row.company_id] || formatDateInput(row.license_expiry_date) || addDays(row.created_at, LICENSE_DAYS)
    const command = buildCommand(row.company_code, expiry)
    try {
      await navigator.clipboard.writeText(command)
      setCopied(row.company_id)
      notify('Build command copied to clipboard')
    } catch {
      notify(command, 'info')
    }
  }

  const downloadConfig = (row: Row) => {
    const expiry = buildDates[row.company_id] || formatDateInput(row.license_expiry_date) || addDays(row.created_at, LICENSE_DAYS)
    const blob = new Blob([envConfig(row, expiry)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '.env.company'
    link.click()
    URL.revokeObjectURL(url)
  }

  const openCompany = () => {
    setCompanyForm({ ...company, ...companySettings })
    setError('')
  }

  const createUser = async () => {
    setSavingUser(true)
    setError('')
    try {
      const user = await insertRow<Row>('users', {
        company_id: session.company.company_id,
        company_code: session.company.company_code,
        cnic: newUser.cnic,
        login_id: newUser.login_id,
        password: newUser.password,
        full_name: newUser.full_name,
        email: newUser.email || '',
        phone: newUser.phone || '',
        role: newUser.role,
        customer_id: newUser.customer_id || null,
      })
      await insertRow('user_policies', {
        company_id: session.company.company_id,
        user_id: user.id,
        can_view_stock: true,
        can_edit_vouchers: ['master', 'super_user', 'sales_approver', 'super_admin', 'platform_master'].includes(newUser.role),
        can_delete_vouchers: ['master', 'super_user', 'sales_approver', 'super_admin', 'platform_master'].includes(newUser.role),
        can_print_vouchers: ['master', 'super_user', 'sales_approver', 'super_admin', 'platform_master'].includes(newUser.role),
      })
      notify('User created')
      setUserOpen(false)
      setNewUser({ cnic: randomCnic(), login_id: '', password: '', full_name: '', email: '', phone: '', role: 'master', customer_id: '' })
      await users.reload()
      await policies.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to create user')
    } finally {
      setSavingUser(false)
    }
  }

  const toggleUser = async (row: Row) => {
    if (isPlatformMasterUser(row)) {
      notify('The Platform Master User cannot be edited by any Super User', 'error')
      return
    }
    try {
      await updateRow('users', row.id, { is_active: !row.is_active })
      await users.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to update user', 'error')
    }
  }

  const togglePolicy = async (row: Row, key: string) => {
    if (!master) {
      notify('Only the Platform Master User can change policies', 'error')
      return
    }
    if (isPlatformMasterUser(row)) {
      notify('The Platform Master User cannot be restricted', 'error')
      return
    }
    try {
      const existing = policyByUser.get(row.id)
      if (existing) await updateRow('user_policies', existing.id, { [key]: !existing[key] })
      else
        await insertRow('user_policies', {
          company_id: row.company_id,
          user_id: row.id,
          can_view_stock: true,
          [key]: true,
        })
      await policies.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to update policy', 'error')
    }
  }

  const saveCompany = async () => {
    if (!companyForm) return
    setSavingUser(true)
    setError('')
    try {
      await updateRow('companies', company.company_id, {
        company_name: companyForm.company_name,
        short_name: companyForm.short_name || '',
        address: companyForm.address || '',
        city: companyForm.city || '',
        country: companyForm.country || '',
        ntn_strn: companyForm.ntn_strn || '',
        bank_name: companyForm.bank_name || '',
        bank_account: companyForm.bank_account || '',
      })
      await upsertRow(
        'company_settings',
        {
          company_id: company.company_id,
          logo_text: companyForm.logo_text || '',
          phone: companyForm.phone || '',
          email: companyForm.email || '',
          quotation_prefix: companyForm.quotation_prefix || 'QTN',
          sale_order_prefix: companyForm.sale_order_prefix || 'SO',
          gdn_prefix: companyForm.gdn_prefix || 'GDN',
          gate_pass_prefix: companyForm.gate_pass_prefix || 'GP',
          invoice_prefix: companyForm.invoice_prefix || 'INV',
          receipt_prefix: companyForm.receipt_prefix || 'RCP',
          registered_invoice_prefix: companyForm.registered_invoice_prefix || 'GST ST-REG',
          unregistered_invoice_prefix: companyForm.unregistered_invoice_prefix || 'ST',
          default_hs_code: companyForm.default_hs_code || '9619.0090',
          sales_tax_rate: Number(companyForm.sales_tax_rate || 18),
          further_tax_rate: Number(companyForm.further_tax_rate || 0),
          sec236g_filer_rate: Number(companyForm.sec236g_filer_rate || 0.001),
          sec236g_non_filer_rate: Number(companyForm.sec236g_non_filer_rate || 0.02),
        },
        'company_id',
      )
      notify('Company profile saved')
      setCompanyForm(null)
      refresh()
      await companies.reload()
      await settings.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to save company profile')
    } finally {
      setSavingUser(false)
    }
  }

  const download = () =>
    exportSheets(
      [
        { name: 'Companies', rows: companies.rows },
        { name: 'Settings', rows: settings.rows },
        { name: 'Users', rows: users.rows.map(({ password, ...rest }) => rest) },
        { name: 'Policies', rows: policies.rows },
      ],
      `${session.company.company_code}_Admin`,
    )

  const tabs: Array<{ key: AdminTab; label: string; masterOnly?: boolean }> = [
    { key: 'users', label: 'Users' },
    { key: 'policies', label: 'Policy Control', masterOnly: true },
    { key: 'company', label: 'Company' },
    { key: 'licenses', label: 'License Control', masterOnly: true },
    { key: 'builder', label: 'Client .exe Setup Builder', masterOnly: true },
  ]

  return (
    <div>
      <PageHeader
        title={master ? 'Platform Master Console' : 'Security & Administration'}
        subtitle={master
          ? 'Users, voucher policies, company profiles, 40-day licenses and company-locked desktop builds.'
          : 'Users, company profile and document numbering for your own company.'}
        actions={
          <>
            <Button variant="secondary" onClick={download}>Export</Button>
            {activeTab === 'users' && <Button onClick={() => setUserOpen(true)} disabled={!permissions.manageUsers}>New User</Button>}
            {activeTab === 'company' && <Button onClick={openCompany} disabled={!permissions.manageCompany}>Edit Company</Button>}
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.filter((item) => !item.masterOnly || master).map((item) => (
          <Button key={item.key} variant={activeTab === item.key ? 'primary' : 'secondary'} onClick={() => setTab(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

      {activeTab === 'users' && (
        <Card>
          <Table
            rowKey={(row) => row.id}
            rows={visibleUsers}
            columns={[
              { key: 'full_name', label: 'Name' },
              { key: 'login_id', label: 'Login', render: (row) => <span className="font-semibold text-cyan-300">{row.login_id}</span> },
              { key: 'cnic', label: 'CNIC' },
              { key: 'role', label: 'Role', render: (row) => <Badge tone="indigo">{titleCase(row.role)}</Badge> },
              { key: 'email', label: 'Email' },
              { key: 'is_active', label: 'Active', render: (row) => <Badge tone={row.is_active ? 'green' : 'red'}>{row.is_active ? 'yes' : 'no'}</Badge> },
              { key: 'last_login_at', label: 'Last Login', render: (row) => dateTimeLabel(row.last_login_at) },
              { key: 'actions', label: 'Actions', render: (row) => <Button size="sm" variant="secondary" onClick={() => void toggleUser(row)} disabled={!master && !permissions.manageUsers}>{row.is_active ? 'Disable' : 'Enable'}</Button> },
            ]}
          />
        </Card>
      )}

      {activeTab === 'policies' && master && (
        <Card>
          <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
            Platform Master only · Voucher rights for Company Super Users are enabled by default and can be revoked here at any time.
          </div>
          <Table
            rowKey={(row) => row.id}
            rows={visibleUsers}
            columns={[
              { key: 'full_name', label: 'User' },
              { key: 'role', label: 'Role', render: (row) => titleCase(row.role) },
              ...POLICY_KEYS.map((key) => ({
                key,
                label: titleCase(key.replace('can_', '')),
                render: (row: Row) => (
                  <input
                    type="checkbox"
                    checked={isPlatformMasterUser(row) ? true : (['can_edit_vouchers', 'can_delete_vouchers', 'can_print_vouchers'].includes(key)
                      ? policyByUser.get(row.id)?.[key] !== false
                      : !!policyByUser.get(row.id)?.[key])}
                    onChange={() => void togglePolicy(row, key)}
                    disabled={isPlatformMasterUser(row)}
                  />
                ),
              })),
            ]}
          />
        </Card>
      )}

      {activeTab === 'company' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-white">Company Identity</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div><span className="text-slate-500">Name:</span> {company.company_name}</div>
              <div><span className="text-slate-500">Code:</span> {company.company_code}</div>
              <div><span className="text-slate-500">Address:</span> {company.address}</div>
              <div><span className="text-slate-500">NTN/STRN:</span> {company.ntn_strn}</div>
              <div><span className="text-slate-500">Bank:</span> {company.bank_name} · {company.bank_account}</div>
              <div><span className="text-slate-500">Phone:</span> {companySettings.phone || '—'}</div>
              <div><span className="text-slate-500">Email:</span> {companySettings.email || '—'}</div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-white">Document Numbering & Tax</h3>
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <div>Quotation: {companySettings.quotation_prefix}</div>
              <div>Sale Order: {companySettings.sale_order_prefix}</div>
              <div>GDN: {companySettings.gdn_prefix}</div>
              <div>Gate Pass: {companySettings.gate_pass_prefix}</div>
              <div>Invoice: {companySettings.invoice_prefix}</div>
              <div>Registered Invoice: {companySettings.registered_invoice_prefix}</div>
              <div>Unregistered Invoice: {companySettings.unregistered_invoice_prefix}</div>
              <div>Receipt: {companySettings.receipt_prefix}</div>
              <div>Sales Tax: {companySettings.sales_tax_rate}%</div>
              <div>Further Tax: {companySettings.further_tax_rate}%</div>
              <div>236G Filer: {companySettings.sec236g_filer_rate}</div>
              <div>236G Non-Filer: {companySettings.sec236g_non_filer_rate}</div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'licenses' && master && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Company License Expiry Control</h3>
                <p className="mt-1 text-sm text-slate-400">
                  All {visibleCompanies.length} companies · Default term {LICENSE_DAYS} days · Lockout applies immediately on expiry or suspension.
                </p>
              </div>
              <Badge tone="indigo">Platform Master only</Badge>
            </div>
          </Card>
          <Card>
            <Table
              rowKey={(row) => row.company_id}
              rows={visibleCompanies}
              columns={[
                { key: 'company_name', label: 'Company' },
                { key: 'company_code', label: 'Code', render: (row) => <span className="font-semibold text-cyan-300">{row.company_code}</span> },
                {
                  key: 'license_expiry_date',
                  label: 'License Expiry Date',
                  render: (row) => (
                    <Input
                      type="date"
                      className="w-40"
                      value={licenseDraft(row).license_expiry_date}
                      onChange={(event) => setLicenseDrafts({ ...licenseDrafts, [row.company_id]: { ...licenseDraft(row), license_expiry_date: event.target.value } })}
                    />
                  ),
                },
                {
                  key: 'countdown',
                  label: 'Countdown',
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <Badge tone={licenseTone(licenseDraft(row).license_expiry_date)}>{licenseLabel(licenseDraft(row).license_expiry_date)}</Badge>
                      {String(licenseDraft(row).license_status).toLowerCase() === 'suspended' && <Badge tone="red">Suspended</Badge>}
                    </div>
                  ),
                },
                {
                  key: 'license_status',
                  label: 'Status',
                  render: (row) => (
                    <Select
                      className="w-32"
                      value={licenseDraft(row).license_status}
                      onChange={(event) => setLicenseDrafts({ ...licenseDrafts, [row.company_id]: { ...licenseDraft(row), license_status: event.target.value } })}
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </Select>
                  ),
                },
                {
                  key: 'support_contact',
                  label: 'Vendor Renewal Contact',
                  render: (row) => (
                    <Input
                      className="w-64"
                      value={licenseDraft(row).support_contact}
                      onChange={(event) => setLicenseDrafts({ ...licenseDrafts, [row.company_id]: { ...licenseDraft(row), support_contact: event.target.value } })}
                    />
                  ),
                },
                {
                  key: 'actions',
                  label: 'Quick Extend',
                  render: (row) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void extendLicense(row, LICENSE_DAYS)}>+40 Days</Button>
                      <Button size="sm" variant="secondary" onClick={() => void extendLicense(row, 365)}>+1 Year</Button>
                      <Button size="sm" onClick={() => void saveLicense(row)}>Save</Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {activeTab === 'builder' && master && (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="font-bold text-white">Company-Locked Desktop .exe Setup Builder</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Each build embeds the company code and license expiry date. The Company / Customer Code field is locked in the desktop
              login, users of other companies are rejected, and the app locks itself when the embedded date passes. Copy the generated
              command on the build machine, or download the matching <code>.env.company</code> configuration file.
            </p>
          </Card>
          <Card>
            <Table
              rowKey={(row) => row.company_id}
              rows={visibleCompanies}
              columns={[
                { key: 'company_name', label: 'Company' },
                { key: 'company_code', label: 'Code', render: (row) => <span className="font-semibold text-cyan-300">{row.company_code}</span> },
                {
                  key: 'expiry',
                  label: 'Embedded Expiry Date',
                  render: (row) => (
                    <Input
                      type="date"
                      className="w-40"
                      value={buildDates[row.company_id] || formatDateInput(row.license_expiry_date) || addDays(row.created_at, LICENSE_DAYS)}
                      onChange={(event) => setBuildDates({ ...buildDates, [row.company_id]: event.target.value })}
                    />
                  ),
                },
                {
                  key: 'command',
                  label: 'Build Command',
                  render: (row) => {
                    const expiry = buildDates[row.company_id] || formatDateInput(row.license_expiry_date) || addDays(row.created_at, LICENSE_DAYS)
                    return (
                      <code className="block max-w-md truncate rounded bg-slate-950/70 px-2 py-1 text-[11px] text-cyan-200">
                        {buildCommand(row.company_code, expiry)}
                      </code>
                    )
                  },
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void copyBuildCommand(row)}>{copied === row.company_id ? 'Copied' : 'Copy Command'}</Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadConfig(row)}>.env.company</Button>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      )}

      <Modal open={userOpen} title="New User" onClose={() => setUserOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name"><Input value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} /></Field>
          <Field label="Login ID"><Input value={newUser.login_id} onChange={(event) => setNewUser({ ...newUser, login_id: event.target.value })} /></Field>
          <Field label="Password"><Input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} /></Field>
          <Field label="CNIC"><Input value={newUser.cnic} onChange={(event) => setNewUser({ ...newUser, cnic: event.target.value })} /></Field>
          <Field label="Role">
            <Select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
              {ROLES.filter((role) => master || !['super_admin', 'platform_master'].includes(role)).map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
            </Select>
          </Field>
          <Field label="Email"><Input value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></Field>
          <Field label="Phone"><Input value={newUser.phone} onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })} /></Field>
          <Field label="Linked Customer ID"><Input value={newUser.customer_id} onChange={(event) => setNewUser({ ...newUser, customer_id: event.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUserOpen(false)}>Cancel</Button>
          <Button onClick={() => void createUser()} disabled={savingUser}>{savingUser ? 'Saving…' : 'Create User'}</Button>
        </div>
      </Modal>

      <Modal open={!!companyForm} title="Edit Company Profile" onClose={() => setCompanyForm(null)} width="max-w-5xl">
        {companyForm && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Company Name"><Input value={companyForm.company_name} onChange={(event) => setCompanyForm({ ...companyForm, company_name: event.target.value })} /></Field>
            <Field label="Short Name"><Input value={companyForm.short_name || ''} onChange={(event) => setCompanyForm({ ...companyForm, short_name: event.target.value })} /></Field>
            <Field label="NTN / STRN"><Input value={companyForm.ntn_strn || ''} onChange={(event) => setCompanyForm({ ...companyForm, ntn_strn: event.target.value })} /></Field>
            <Field label="Address"><Input value={companyForm.address || ''} onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })} /></Field>
            <Field label="City"><Input value={companyForm.city || ''} onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })} /></Field>
            <Field label="Country"><Input value={companyForm.country || ''} onChange={(event) => setCompanyForm({ ...companyForm, country: event.target.value })} /></Field>
            <Field label="Bank Name"><Input value={companyForm.bank_name || ''} onChange={(event) => setCompanyForm({ ...companyForm, bank_name: event.target.value })} /></Field>
            <Field label="Bank Account"><Input value={companyForm.bank_account || ''} onChange={(event) => setCompanyForm({ ...companyForm, bank_account: event.target.value })} /></Field>
            <Field label="Phone"><Input value={companyForm.phone || ''} onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })} /></Field>
            <Field label="Email"><Input value={companyForm.email || ''} onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })} /></Field>
            <Field label="Quotation Prefix"><Input value={companyForm.quotation_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, quotation_prefix: event.target.value })} /></Field>
            <Field label="Sale Order Prefix"><Input value={companyForm.sale_order_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, sale_order_prefix: event.target.value })} /></Field>
            <Field label="GDN Prefix"><Input value={companyForm.gdn_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, gdn_prefix: event.target.value })} /></Field>
            <Field label="Gate Pass Prefix"><Input value={companyForm.gate_pass_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, gate_pass_prefix: event.target.value })} /></Field>
            <Field label="Invoice Prefix"><Input value={companyForm.invoice_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, invoice_prefix: event.target.value })} /></Field>
            <Field label="Receipt Prefix"><Input value={companyForm.receipt_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, receipt_prefix: event.target.value })} /></Field>
            <Field label="Registered Invoice Prefix"><Input value={companyForm.registered_invoice_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, registered_invoice_prefix: event.target.value })} /></Field>
            <Field label="Unregistered Invoice Prefix"><Input value={companyForm.unregistered_invoice_prefix || ''} onChange={(event) => setCompanyForm({ ...companyForm, unregistered_invoice_prefix: event.target.value })} /></Field>
            <Field label="Sales Tax %"><Input type="number" step="0.001" value={companyForm.sales_tax_rate} onChange={(event) => setCompanyForm({ ...companyForm, sales_tax_rate: event.target.value })} /></Field>
            <Field label="Further Tax %"><Input type="number" step="0.001" value={companyForm.further_tax_rate} onChange={(event) => setCompanyForm({ ...companyForm, further_tax_rate: event.target.value })} /></Field>
            <Field label="236G Filer Rate"><Input type="number" step="0.00001" value={companyForm.sec236g_filer_rate} onChange={(event) => setCompanyForm({ ...companyForm, sec236g_filer_rate: event.target.value })} /></Field>
            <Field label="236G Non-Filer Rate"><Input type="number" step="0.00001" value={companyForm.sec236g_non_filer_rate} onChange={(event) => setCompanyForm({ ...companyForm, sec236g_non_filer_rate: event.target.value })} /></Field>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCompanyForm(null)}>Cancel</Button>
          <Button onClick={() => void saveCompany()} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save Company'}</Button>
        </div>
      </Modal>
    </div>
  )
}
