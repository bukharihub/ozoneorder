'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { Copy, Download, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import { callRpc, callRpcRows, listRows, updateRow } from '@/lib/api'
import { downloadCsv, downloadJson, parseCsv } from '@/lib/csv'
import { errorMessage } from '@/lib/format'
import { parseLinkedCustomerIds } from '@/lib/linkedCustomers'
import { uploadCompanyLogo, validateLogoFile } from '@/lib/logo'
import { defaultPermissions, PERMISSION_MODULES } from '@/lib/permissions'
import { useRows } from '@/lib/useRows'
import type { Customer, PermissionMap, Role, SessionCompany, SessionUser } from '@/lib/types'
import { useApp } from '../AppProvider'
import { CompanyLogo } from '../CompanyLogo'
import { Button, Card, Field, Modal, Notice, Toast } from '../Ui'


const roles: Role[] = ['COMPANY_ADMIN', 'CUSTOMER', 'STORE_FG', 'ACCOUNTS', 'SUPER_ADMIN']
const FACTORY_RESET_SUCCESS = 'Factory Reset Completed — All vouchers cleared and stock restored to opening balances'

const randomCredential = (length: number) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
interface CustomerCredential { customerName: string; username: string; password: string; url: string; message: string }

function CustomerMultiPicker({ customers, value, onChange }: { customers: Customer[]; value: string[]; onChange: (next: string[]) => void }) {
  const [search, setSearch] = useState('')
  const visible = customers.filter((customer) => `${customer.business_name} ${customer.delivery_destination} ${customer.bank_account_no || ''} ${customer.bank_branch_name || ''}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <input className="field-input mb-2" placeholder="Search name / city / bank account" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="app-scroll max-h-52 space-y-1 overflow-auto">
        {visible.map((customer) => (
          <label key={customer.id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs">
            <input className="mt-0.5" type="checkbox" checked={value.includes(customer.id)} onChange={() => toggle(customer.id)} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{customer.business_name}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${customer.registration_status === 'Register' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{customer.registration_status || 'Unregister'}</span>
              </span>
              <span className="block truncate text-[10px] text-slate-500">{customer.delivery_destination || '—'} · {customer.bank_account_no ? `${customer.bank_account_no}${customer.bank_branch_name ? ` · ${customer.bank_branch_name}` : ''}` : 'No bank account / branch'}</span>
            </span>
          </label>
        ))}
        {!visible.length && <p className="py-3 text-center text-xs text-slate-500">No customers found</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-600">{value.length} customer(s) selected</span>
        <div className="flex gap-1"><Button variant="secondary" onClick={() => onChange(visible.map((customer) => customer.id))}>Select all</Button><Button variant="secondary" onClick={() => onChange([])}>Clear</Button></div>
      </div>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{active ? 'Active' : 'Inactive'}</span>
}


const productRows = (text: string) => {
  const [header, ...data] = parseCsv(text)
  const index = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name)
  return data.map((row) => ({
    size_category: row[index('size_category')] || 'NB',
    product_type: (row[index('product_type')] || 'UNREGISTERED').toUpperCase(),
    product_name: row[index('product_name')],
    hs_code: row[index('hs_code')] || '9619.0090',
    diapers_per_bag: Number(row[index('diapers_per_bag')] || 0),
    bags_per_carton: Number(row[index('bags_per_carton')] || 0),
    opening_stock_ctns: Number(row[index('opening_stock_ctns')] || 0),
    per_diaper_rate: Number(row[index('per_diaper_rate')] || 0),
    per_carton_rate: Number(row[index('per_carton_rate')] || 0),
  })).filter((row) => row.product_name && row.diapers_per_bag > 0 && row.bags_per_carton > 0)
}
const customerRows = (text: string) => {
  const [header, ...data] = parseCsv(text)
  const index = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name)
  return data.map((row) => ({
    cnic_ntn: row[index('cnic_ntn')] || '',
    strn: row[index('strn')] || '',
    business_name: row[index('business_name')],
    delivery_destination: row[index('delivery_destination')] || '',
    registration_status: row[index('registration_status')] === 'Register' ? 'Register' : 'Unregister',
    income_tax_status: row[index('income_tax_status')] === 'Non Filer' ? 'Non Filer' : 'Filer',
    opening_balance: Number(row[index('opening_balance')] || 0),
    bank_account_no: row[index('bank_account_no')] || '',
    bank_branch_name: row[index('bank_branch_name')] || '',
  })).filter((row) => row.business_name)
}

function PermissionMatrix({ value, onChange }: { value: PermissionMap; onChange: (next: PermissionMap) => void }) {
  return (
    <div className="app-scroll overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="table-head"><tr><th className="px-3 py-2">Module</th>{['view','create','edit','delete','print'].map(a => <th key={a} className="px-3 py-2 text-center capitalize">{a}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {PERMISSION_MODULES.map((m) => (
            <tr key={m.key} className="table-row">
              <td className="px-3 py-2 font-semibold">{m.label}</td>
              {(['view','create','edit','delete','print'] as const).map((action) => {
                const supported = m.actions.includes(action)
                const checked = Boolean(value[m.key]?.[action])
                return (
                  <td key={action} className="px-3 py-2 text-center">
                    <input type="checkbox" disabled={!supported} checked={supported && checked} onChange={(e) => {
                      if (!supported) return
                      onChange({ ...value, [m.key]: { ...(value[m.key] || {}), [action]: e.target.checked } })
                    }} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Admin() {
  const { session, version, bump, updateCompany } = useApp()
  const isSuper = session?.user.role === 'SUPER_ADMIN'
  const companyCode = session?.company.company_code || ''
  const users = useRows<SessionUser & { is_active: boolean }>(() => callRpcRows<SessionUser & { is_active: boolean }>('list_company_users'), [version])
  const customers = useRows<Customer>(() => listRows(`${companyCode.toLowerCase()}_customers`, { order: 'business_name' }), [companyCode, version])
  const companies = useRows<any>(() => isSuper ? listRows('sys_companies', { order: 'company_code' }) : Promise.resolve([]), [isSuper, version])

  const [header, setHeader] = useState({
    company_name: session?.company.company_name || '',
    city_country: session?.company.city_country || '',
    ntn_strn: session?.company.ntn_strn || '',
    bank_details: session?.company.bank_details || '',
    address: session?.company.address || '',
    license_expiry_date: session?.company.license_expiry_date || '',
    is_demo_mode: Boolean(session?.company.is_demo_mode),
    demo_started_at: session?.company.demo_started_at ? String(session.company.demo_started_at).slice(0, 16) : '',
    owner_contact_info: session?.company.owner_contact_info || '',
    max_users: session?.company.max_users ?? '',
    entry_lock_date: session?.company.entry_lock_date || '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showUser, setShowUser] = useState(false)
  const [editingUser, setEditingUser] = useState<(SessionUser & { is_active: boolean }) | null>(null)
  const [userForm, setUserForm] = useState<{ username: string; password: string; full_name: string; role: Role; linked_customer_id: string; linked_customer_ids: string[]; hide_rates: boolean; bypass_entry_lock: boolean; permissions: PermissionMap }>({ username: '', password: '', full_name: '', role: 'COMPANY_ADMIN', linked_customer_id: '', linked_customer_ids: [], hide_rates: false, bypass_entry_lock: false, permissions: defaultPermissions('COMPANY_ADMIN') })
  const [bulkBankIds, setBulkBankIds] = useState<string[]>([])
  const [bulkBankAccount, setBulkBankAccount] = useState('')
  const [bulkBankBranch, setBulkBankBranch] = useState('')
  const [userBankAccount, setUserBankAccount] = useState('')
  const [userBankBranch, setUserBankBranch] = useState('')
  const [wizard, setWizard] = useState(false)
  const [companyForm, setCompanyForm] = useState({ company_code: '', company_name: '', city_country: '', ntn_strn: '', bank_details: '', address: '', license_expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), admin_password: 'admin123', is_demo_mode: true, owner_contact_info: '', max_users: '' })
  const [productCsv, setProductCsv] = useState(''); const [customerCsv, setCustomerCsv] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null); const [logoPreview, setLogoPreview] = useState('')
  const [wizardLogoFile, setWizardLogoFile] = useState<File | null>(null); const [wizardLogoPreview, setWizardLogoPreview] = useState('')
  const [credential, setCredential] = useState<CustomerCredential | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetTarget, setResetTarget] = useState<any | null>(null); const [resetCode, setResetCode] = useState('')
  const [resetToast, setResetToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const productFile = useRef<HTMLInputElement>(null); const customerFile = useRef<HTMLInputElement>(null); const logoInput = useRef<HTMLInputElement>(null); const wizardLogoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!resetToast) return
    const timer = window.setTimeout(() => setResetToast(null), 8000)
    return () => window.clearTimeout(timer)
  }, [resetToast])

  if (!session) return null


  const visibleUsers = useMemo(() => users.rows.filter((u) => isSuper || (u.company_code === companyCode && u.role !== 'SUPER_ADMIN')), [users.rows, isSuper, companyCode])
  const canManageUser = (u: SessionUser) => isSuper || (session.user.role === 'COMPANY_ADMIN' && u.company_code === companyCode && u.role !== 'SUPER_ADMIN')
  const canToggleUserActive = (u: SessionUser) => canManageUser(u) && u.id !== session.user.id


  const saveHeader = async () => {
    setError(''); setNotice('')
    try {
      if (!isSuper) throw new Error('Only SUPER_ADMIN can update company settings')
      await callRpc('update_company_settings', {
        p_company_code: companyCode,
        p_company_name: header.company_name,
        p_city_country: header.city_country,
        p_ntn_strn: header.ntn_strn,
        p_bank_details: header.bank_details,
        p_address: header.address,
        p_license_expiry_date: header.license_expiry_date,
        p_is_demo_mode: header.is_demo_mode,
        p_demo_started_at: header.demo_started_at ? new Date(header.demo_started_at).toISOString() : null,
        p_owner_contact_info: header.owner_contact_info,
        p_max_users: header.max_users === '' ? null : Number(header.max_users),
        p_entry_lock_date: header.entry_lock_date || null,
      })
      updateCompany({
        company_name: header.company_name, city_country: header.city_country, ntn_strn: header.ntn_strn,
        bank_details: header.bank_details, address: header.address, license_expiry_date: header.license_expiry_date,
        is_demo_mode: header.is_demo_mode, demo_started_at: header.demo_started_at || null,
        owner_contact_info: header.owner_contact_info, max_users: header.max_users === '' ? null : Number(header.max_users),
        entry_lock_date: header.entry_lock_date || null,
      } as any)
      setNotice('Company settings saved'); bump(); void companies.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const chooseLogo = (file: File | undefined, target: 'settings' | 'wizard') => {
    setError(''); if (!file) return
    try {
      validateLogoFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        const preview = String(reader.result || '')
        if (target === 'settings') { setLogoFile(file); setLogoPreview(preview) } else { setWizardLogoFile(file); setWizardLogoPreview(preview) }
      }
      reader.readAsDataURL(file)
    } catch (caught) { setError(errorMessage(caught)) }
  }
  const saveLogo = async () => {
    if (!logoFile) return; setError(''); setBusy(true)
    try {
      if (!isSuper) throw new Error('Only SUPER_ADMIN can update the company logo')
      const url = await uploadCompanyLogo(logoFile, companyCode)
      await updateRow('sys_companies', session.company.id, { logo_url: url })
      updateCompany({ logo_url: url }); setNotice('Company logo saved'); setLogoFile(null); setLogoPreview('')
    } catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }
  const removeLogo = async () => {
    setError(''); setBusy(true)
    try {
      if (!isSuper) throw new Error('Only SUPER_ADMIN can update the company logo')
      await updateRow('sys_companies', session.company.id, { logo_url: '' }); updateCompany({ logo_url: '' }); setNotice('Company logo removed'); setLogoFile(null); setLogoPreview('')
    }
    catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }

  const openNewUser = () => { setEditingUser(null); setUserForm({ username: '', password: '', full_name: '', role: 'COMPANY_ADMIN', linked_customer_id: '', linked_customer_ids: [], hide_rates: false, bypass_entry_lock: false, permissions: defaultPermissions('COMPANY_ADMIN') }); setUserBankAccount(''); setUserBankBranch(''); setShowUser(true); setError('') }
  const openEditUser = (u: SessionUser & { is_active: boolean }) => {
    if (!canManageUser(u)) return
    const linkedCustomerIds = parseLinkedCustomerIds({ linked_customer_id: u.linked_customer_id, linked_customer_ids: u.linked_customer_ids })
    const firstCustomer = customers.rows.find((customer) => customer.id === linkedCustomerIds[0])
    setEditingUser(u)
    setUserForm({ username: u.username, password: '', full_name: u.full_name || '', role: u.role as Role, linked_customer_id: u.linked_customer_id || '', linked_customer_ids: linkedCustomerIds, hide_rates: Boolean(u.hide_rates_and_amounts), bypass_entry_lock: Boolean(u.bypass_entry_lock), permissions: (u.permissions as PermissionMap) || defaultPermissions(u.role as Role) })
    setUserBankAccount(firstCustomer?.bank_account_no || '')
    setUserBankBranch(firstCustomer?.bank_branch_name || '')
    setShowUser(true); setError('')
  }

  const createCustomerLogin = async (customer: Customer) => {
    setError(''); setBusy(true)
    try {
      const handle = customer.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'customer'
      const username = `${handle}.${randomCredential(4).toLowerCase()}`
      const password = randomCredential(10)
      await callRpc('create_company_user', { p_company_code: companyCode, p_username: username, p_password: password, p_full_name: customer.business_name, p_role: 'CUSTOMER', p_linked_customer_id: customer.id, p_linked_customer_ids: [customer.id], p_hide_rates: true, p_permissions: defaultPermissions('CUSTOMER') })
      const url = `${window.location.origin}${window.location.pathname}?company=${encodeURIComponent(companyCode)}`
      const message = `${session.company.company_name} Customer Portal\nUsername: ${username}\nPassword: ${password}\nLogin: ${url}`
      setCredential({ customerName: customer.business_name, username, password, url, message }); setNotice('Customer login created'); users.reload()
    } catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }
  const copyCredential = async () => {
    if (!credential) return
    try { await navigator.clipboard.writeText(credential.message); setNotice('Login message copied — ready to paste into WhatsApp') }
    catch { const field = document.createElement('textarea'); field.value = credential.message; document.body.appendChild(field); field.select(); document.execCommand('copy'); document.body.removeChild(field); setNotice('Login message copied — ready to paste into WhatsApp') }
  }

  const saveUser = async () => {
    setError('')
    if (userForm.role === 'CUSTOMER' && !userForm.linked_customer_ids.length) {
      setError('Select at least one linked customer for a CUSTOMER account')
      return
    }
    try {
      if (editingUser) {
        await callRpc('update_company_user', { p_user_id: editingUser.id, p_is_active: editingUser.is_active !== false, p_hide_rates: userForm.hide_rates, p_full_name: userForm.full_name, p_role: userForm.role, p_permissions: userForm.permissions, p_bypass_entry_lock: userForm.bypass_entry_lock, p_password: userForm.password || null, p_linked_customer_id: userForm.linked_customer_ids[0] || null, p_linked_customer_ids: userForm.linked_customer_ids })
        setNotice('User updated')
      } else {
        await callRpc('create_company_user', { p_company_code: companyCode, p_username: userForm.username, p_password: userForm.password, p_full_name: userForm.full_name, p_role: userForm.role, p_linked_customer_id: userForm.linked_customer_ids[0] || userForm.linked_customer_id || null, p_linked_customer_ids: userForm.linked_customer_ids, p_hide_rates: userForm.hide_rates, p_permissions: userForm.permissions, p_bypass_entry_lock: userForm.bypass_entry_lock })
        setNotice('User created')
      }
      setShowUser(false); setEditingUser(null); users.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const applySharedBank = async () => {
    setError(''); setNotice('')
    if (!bulkBankIds.length) { setError('Select at least one customer'); return }
    setBusy(true)
    try {
      await Promise.all(bulkBankIds.map((id) => updateRow(`${companyCode.toLowerCase()}_customers`, id, { bank_account_no: bulkBankAccount.trim(), bank_branch_name: bulkBankBranch.trim() })))
      setNotice(`Bank details applied to ${bulkBankIds.length} customer(s)`)
      customers.reload()
    } catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }

  const applySharedBankToUser = async () => {
    setError('')
    if (!userForm.linked_customer_ids.length) { setError('Select at least one linked customer first'); return }
    setBusy(true)
    try {
      await Promise.all(userForm.linked_customer_ids.map((id) => updateRow(`${companyCode.toLowerCase()}_customers`, id, { bank_account_no: userBankAccount.trim(), bank_branch_name: userBankBranch.trim() })))
      setNotice(`Shared bank account applied to ${userForm.linked_customer_ids.length} selected customer(s)`)
      customers.reload()
    } catch (caught) { setError(errorMessage(caught)) } finally { setBusy(false) }
  }

  const toggleActive = async (user: SessionUser & { is_active: boolean }) => {
    if (!canToggleUserActive(user)) return
    const nextActive = user.is_active === true ? false : true
    setError(''); setNotice('')
    try {
      await callRpc('update_company_user', { p_user_id: user.id, p_is_active: nextActive })
      setNotice(`${user.username} is now ${nextActive ? 'Active' : 'Inactive'}`)
      users.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const toggleCompanyActive = async (company: any) => {
    if (company.company_code === companyCode) return
    const nextActive = company.is_active === true ? false : true
    setError(''); setNotice('')
    try {
      await callRpc('update_company_settings', { p_company_code: company.company_code, p_is_active: nextActive })
      setNotice(`${company.company_code} is now ${nextActive ? 'Active' : 'Inactive'}`)
      companies.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }


  const buildCompany = async () => {
    setError('')
    try {
      if (!isSuper) throw new Error('Only SUPER_ADMIN can create companies')
      const result = await callRpc<{ company_code: string; company_name: string }>('create_company', {
        p_company_code: companyForm.company_code, p_company_name: companyForm.company_name, p_city_country: companyForm.city_country,
        p_ntn_strn: companyForm.ntn_strn, p_bank_details: companyForm.bank_details, p_address: companyForm.address,
        p_license_expiry_date: companyForm.license_expiry_date, p_admin_password: companyForm.admin_password,
        p_is_demo_mode: companyForm.is_demo_mode, p_owner_contact_info: companyForm.owner_contact_info,
        p_max_users: companyForm.max_users === '' ? null : Number(companyForm.max_users),
      })
      if (wizardLogoFile) {
        const logoUrl = await uploadCompanyLogo(wizardLogoFile, result.company_code)
        const rows = await listRows<SessionCompany>('sys_companies', { filters: { company_code: result.company_code }, limit: 1 })
        if (rows[0]) await updateRow('sys_companies', rows[0].id, { logo_url: logoUrl })
      }
      const imported = await callRpc<{ imported: number }>('import_company_data', { p_company_code: result.company_code, p_products: productRows(productCsv), p_customers: customerRows(customerCsv) })
      downloadJson(`${result.company_code}-electron-builder.json`, { appId: `com.ozone.enterprise.${result.company_code.toLowerCase()}`, productName: `${result.company_code} Enterprise ERP`, lockedCompanyCode: result.company_code, licenseExpiryDate: companyForm.license_expiry_date, files: ['out/**/*', 'electron/**/*', 'package.json'], win: { target: [{ target: 'nsis', arch: ['x64'] }], artifactName: `${result.company_code}-Setup-\${version}.exe` } })
      setNotice(`${result.company_name} created with ${imported.imported} imported records. Exe config downloaded.`); setWizard(false); setWizardLogoFile(null); setWizardLogoPreview(''); bump(); companies.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const superCompanyAction = async (fn: string, code: string, confirm = false) => {
    setError(''); setNotice('')
    try { await callRpc(fn, { p_company_code: code }); setNotice(`${fn.replace(/_/g, ' ')}: ${code}`); bump(); companies.reload() }
    catch (caught) { setError(errorMessage(caught)) }
  }
  const factoryReset = async () => {
    if (!resetTarget) return
    const targetCode = String(resetTarget.company_code).toUpperCase()
    if (!isSuper) { setError('Only SUPER_ADMIN can run a factory reset'); return }
    if (resetCode.trim().toUpperCase() !== targetCode) { setError(`Type the exact company code ${targetCode} to confirm factory reset`); return }
    setError(''); setNotice(''); setResetToast(null); setBusy(true)
    try {
      await callRpc<any>('factory_reset_company', { p_company_code: targetCode })
      setNotice(FACTORY_RESET_SUCCESS)
      setResetToast({ type: 'success', message: FACTORY_RESET_SUCCESS })
      setResetTarget(null); setResetCode(''); bump(); void companies.reload()
    } catch (caught) {
      const detail = `Factory Reset failed: ${errorMessage(caught)}`
      setError(detail)
      setResetToast({ type: 'error', message: detail })
    } finally { setBusy(false) }
  }


  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-slate-900">Administration</h1><p className="text-xs text-slate-500">{isSuper ? 'Company settings, users, permissions, and Super Admin governance controls.' : 'Company-scoped user management with granular voucher permissions.'}</p></div>
      {error && <Notice type="error">{error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}
      {resetToast && <Toast type={resetToast.type} message={resetToast.message} onClose={() => setResetToast(null)} />}


      {isSuper && (
        <Card title="Super Admin — Company Master Control" subtitle="Demo lock, license, factory reset, and company-scoped controls">
          <div className="app-scroll overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="table-head"><tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Demo</th><th className="px-3 py-2">Demo Start</th><th className="px-3 py-2">License</th><th className="px-3 py-2">Max Users</th><th className="px-3 py-2">Owner Contact</th><th className="px-3 py-2">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {companies.rows.map((c: any) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-3 py-2 font-semibold">{c.company_code}<div className="text-[11px] font-normal text-slate-500">{c.company_name}</div></td>
                    <td className="px-3 py-2"><StatusBadge active={c.is_active === true} /></td>
                    <td className="px-3 py-2">{c.is_demo_mode ? <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-800">DEMO</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">FULL</span>}</td>
                    <td className="px-3 py-2">{c.demo_started_at ? String(c.demo_started_at).slice(0, 10) : '—'}</td>
                    <td className="px-3 py-2">{c.license_expiry_date}</td>
                    <td className="px-3 py-2">{c.max_users ?? '—'}</td>
                    <td className="px-3 py-2">{c.owner_contact_info || '—'}</td>
                    <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                      <Button variant="secondary" onClick={() => void toggleCompanyActive(c)} disabled={c.company_code === companyCode} title={c.company_code === companyCode ? 'You cannot change the status of your own company' : undefined}>{c.is_active === true ? 'Suspend' : 'Activate'}</Button>
                      <Button variant="secondary" onClick={() => void superCompanyAction('extend_company_demo', c.company_code)}>+7 Days</Button>
                      <Button variant="secondary" onClick={() => void superCompanyAction('convert_company_to_full_license', c.company_code)}>Convert Full</Button>
                      <Button variant="danger" onClick={() => { setResetTarget(c); setResetCode(''); setError('') }}><Trash2 className="h-3.5 w-3.5" /> Factory Reset</Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isSuper && <>
        <Card title="Company settings" subtitle="SUPER_ADMIN can manage company profile, license/demo/locks">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Company name"><input className="field-input" value={header.company_name} onChange={(e) => setHeader({ ...header, company_name: e.target.value })} /></Field>
            <Field label="City, country"><input className="field-input" value={header.city_country} onChange={(e) => setHeader({ ...header, city_country: e.target.value })} /></Field>
            <Field label="NTN / STRN"><input className="field-input" value={header.ntn_strn} onChange={(e) => setHeader({ ...header, ntn_strn: e.target.value })} /></Field>
            <Field label="Bank details" className="col-span-2"><input className="field-input" value={header.bank_details} onChange={(e) => setHeader({ ...header, bank_details: e.target.value })} /></Field>
            <Field label="License expiry"><input className="field-input" type="date" value={header.license_expiry_date} onChange={(e) => setHeader({ ...header, license_expiry_date: e.target.value })} /></Field>
            <Field label="Address" className="col-span-3"><input className="field-input" value={header.address} onChange={(e) => setHeader({ ...header, address: e.target.value })} /></Field>
            <Field label="Manual entry lock date"><input className="field-input" type="date" value={header.entry_lock_date || ''} onChange={(e) => setHeader({ ...header, entry_lock_date: e.target.value })} /></Field>
            <Field label="Demo mode"><select className="field-input" value={header.is_demo_mode ? 'true' : 'false'} onChange={(e) => setHeader({ ...header, is_demo_mode: e.target.value === 'true' })}><option value="false">false</option><option value="true">true</option></select></Field>
            <Field label="Demo started at"><input className="field-input" type="datetime-local" value={header.demo_started_at} onChange={(e) => setHeader({ ...header, demo_started_at: e.target.value })} /></Field>
            <Field label="Max users"><input className="field-input" type="number" value={header.max_users} onChange={(e) => setHeader({ ...header, max_users: e.target.value === '' ? '' : Number(e.target.value) })} /></Field>
            <Field label="Owner contact" className="col-span-2"><input className="field-input" value={header.owner_contact_info} onChange={(e) => setHeader({ ...header, owner_contact_info: e.target.value })} placeholder="Owner Name / Phone / WhatsApp" /></Field>
          </div>
          <div className="mt-3 flex justify-end"><Button onClick={() => void saveHeader()}>Save settings</Button></div>
        </Card>

        <Card title="Company logo" subtitle="Appears on printable vouchers, login, and customer portal">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">{logoPreview ? <img src={logoPreview} alt="Logo preview" className="company-logo" /> : <CompanyLogo url={session.company.logo_url} companyCode={companyCode} companyName={session.company.company_name} />}</div>
            <div className="min-w-[260px] flex-1 space-y-3">
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { chooseLogo(e.target.files?.[0], 'settings'); e.target.value = '' }} />
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => logoInput.current?.click()}>Choose logo</Button><Button onClick={() => void saveLogo()} disabled={!logoFile || busy}>{busy ? 'Saving…' : 'Upload logo'}</Button><Button variant="danger" onClick={() => void removeLogo()} disabled={busy || (!session.company.logo_url && !logoPreview)}>Remove Logo</Button></div>
              <p className="text-xs text-slate-500">PNG, JPG, SVG or WEBP up to 2MB.</p>
            </div>
          </div>
        </Card>
      </>}

      <Card title="Users & Permissions" subtitle="Company-scoped user management with granular voucher permissions" actions={<div className="flex gap-2"><Button variant="secondary" onClick={() => users.reload()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button><Button onClick={openNewUser}><Plus className="h-3.5 w-3.5" /> New user</Button></div>}>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="table-head"><tr><th className="px-3 py-2">Username</th><th className="px-3 py-2">Full name</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Bypass Lock</th><th className="px-3 py-2">Active</th><th className="px-3 py-2">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="px-3 py-2 font-semibold">{u.username}</td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.bypass_entry_lock ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2"><StatusBadge active={u.is_active === true} /></td>
                  <td className="px-3 py-2"><div className="flex gap-1 justify-end">
                    <Button variant="secondary" onClick={() => openEditUser(u)} disabled={!canManageUser(u)}>Edit / Permissions</Button>
                    <Button variant="secondary" onClick={() => void toggleActive(u)} disabled={!canToggleUserActive(u)} title={u.id === session.user.id ? 'You cannot deactivate your own account' : undefined}>{u.is_active === true ? 'Deactivate' : 'Activate'}</Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Shared bank account helper" subtitle="Apply one bank account / branch to multiple customers (e.g. booker groups)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="BANK ACCOUNT NO / IBAN"><input className="field-input" value={bulkBankAccount} onChange={(event) => setBulkBankAccount(event.target.value)} /></Field>
          <Field label="BANK & BRANCH NAME"><input className="field-input" value={bulkBankBranch} onChange={(event) => setBulkBankBranch(event.target.value)} /></Field>
          <Field label="Customers" className="md:col-span-2"><CustomerMultiPicker customers={customers.rows} value={bulkBankIds} onChange={setBulkBankIds} /></Field>
        </div>
        <div className="mt-3 flex justify-end"><Button onClick={() => void applySharedBank()} disabled={busy || !bulkBankIds.length}>{busy ? 'Applying…' : 'Apply to selected customers'}</Button></div>
      </Card>

      {isSuper && (
        <Card title="New Company Setup & Template Wizard" subtitle="Creates isolated tables and locked desktop build config">
          <Button onClick={() => setWizard(true)}>Open company wizard</Button>
        </Card>
      )}

      {showUser && (
        <Modal title={editingUser ? `Edit user — ${editingUser.username}` : 'Create user'} onClose={() => { setShowUser(false); setEditingUser(null) }} wide>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Username"><input className="field-input" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} disabled={Boolean(editingUser)} /></Field>
              <Field label={editingUser ? 'Reset password (optional)' : 'Password'}><input className="field-input" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder={editingUser ? 'Leave blank to keep current' : ''} /></Field>
              <Field label="Full name"><input className="field-input" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} /></Field>
              <Field label="Role"><select className="field-input" value={userForm.role} onChange={(e) => { const role = e.target.value as Role; setUserForm({ ...userForm, role, permissions: defaultPermissions(role) }) }}>{roles.filter(r => isSuper || r !== 'SUPER_ADMIN').map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
              {userForm.role === 'CUSTOMER' ? (
                <>
                  <Field label="Linked customers (searchable multi-select)" className="col-span-3"><CustomerMultiPicker customers={customers.rows} value={userForm.linked_customer_ids} onChange={(linked_customer_ids) => setUserForm({ ...userForm, linked_customer_ids, linked_customer_id: linked_customer_ids[0] || '' })} /></Field>
                  <div className="col-span-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="mb-2 text-xs font-bold text-blue-900">Set Shared Bank Account &amp; Branch for Selected Customers</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="BANK ACCOUNT NO / IBAN"><input className="field-input" value={userBankAccount} onChange={(event) => setUserBankAccount(event.target.value)} /></Field>
                      <Field label="BANK & BRANCH NAME"><input className="field-input" value={userBankBranch} onChange={(event) => setUserBankBranch(event.target.value)} /></Field>
                      <div className="flex items-end"><Button variant="secondary" onClick={() => void applySharedBankToUser()} disabled={busy || !userForm.linked_customer_ids.length}>Apply to selected</Button></div>
                    </div>
                  </div>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-xs pt-6"><input type="checkbox" checked={userForm.hide_rates} onChange={(e) => setUserForm({ ...userForm, hide_rates: e.target.checked })} /> Hide rates and amounts</label>
              <label className="flex items-center gap-2 text-xs pt-6"><input type="checkbox" checked={userForm.bypass_entry_lock} onChange={(e) => setUserForm({ ...userForm, bypass_entry_lock: e.target.checked })} /> Bypass 3-day / cutoff lock</label>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">Permission Policy Matrix</p>
              <PermissionMatrix value={userForm.permissions} onChange={(permissions) => setUserForm({ ...userForm, permissions })} />
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setShowUser(false); setEditingUser(null) }}>Cancel</Button><Button onClick={() => void saveUser()}>{editingUser ? 'Save user' : 'Create user'}</Button></div>
          </div>
        </Modal>
      )}

      {wizard && isSuper && (
        <Modal title="New Company Setup Wizard" onClose={() => setWizard(false)} wide>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Company code"><input className="field-input uppercase" value={companyForm.company_code} onChange={(e) => setCompanyForm({ ...companyForm, company_code: e.target.value.toUpperCase() })} placeholder="NEWCO" /></Field>
              <Field label="Company name"><input className="field-input" value={companyForm.company_name} onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} /></Field>
              <Field label="City, country"><input className="field-input" value={companyForm.city_country} onChange={(e) => setCompanyForm({ ...companyForm, city_country: e.target.value })} /></Field>
              <Field label="NTN / STRN"><input className="field-input" value={companyForm.ntn_strn} onChange={(e) => setCompanyForm({ ...companyForm, ntn_strn: e.target.value })} /></Field>
              <Field label="Bank details"><input className="field-input" value={companyForm.bank_details} onChange={(e) => setCompanyForm({ ...companyForm, bank_details: e.target.value })} /></Field>
              <Field label="License expiry"><input className="field-input" type="date" value={companyForm.license_expiry_date} onChange={(e) => setCompanyForm({ ...companyForm, license_expiry_date: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2"><input className="field-input" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} /></Field>
              <Field label="Admin password"><input className="field-input" value={companyForm.admin_password} onChange={(e) => setCompanyForm({ ...companyForm, admin_password: e.target.value })} /></Field>
              <Field label="Demo mode"><select className="field-input" value={companyForm.is_demo_mode ? 'true' : 'false'} onChange={(e) => setCompanyForm({ ...companyForm, is_demo_mode: e.target.value === 'true' })}><option value="true">true (7-day auto lock)</option><option value="false">false (full license)</option></select></Field>
              <Field label="Max users"><input className="field-input" type="number" value={companyForm.max_users} onChange={(e) => setCompanyForm({ ...companyForm, max_users: e.target.value })} /></Field>
              <Field label="Owner contact" className="col-span-2"><input className="field-input" value={companyForm.owner_contact_info} onChange={(e) => setCompanyForm({ ...companyForm, owner_contact_info: e.target.value })} placeholder="Owner Name / Phone / WhatsApp" /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-20 w-32 items-center justify-center rounded border border-slate-200 bg-white p-2">{wizardLogoPreview ? <img src={wizardLogoPreview} alt="Company logo preview" className="company-logo" /> : <span className="text-[11px] text-slate-400">Logo preview</span>}</div>
              <div className="flex-1 space-y-2"><input ref={wizardLogoInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { chooseLogo(e.target.files?.[0], 'wizard'); e.target.value = '' }} /><Button variant="secondary" onClick={() => wizardLogoInput.current?.click()}>Choose company logo</Button>{wizardLogoFile && <Button variant="danger" onClick={() => { setWizardLogoFile(null); setWizardLogoPreview('') }}>Remove Logo</Button>}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Card title="Products CSV"><div className="flex gap-2"><Button variant="secondary" onClick={() => downloadCsv('products_template.csv', [['size_category','product_type','product_name','hs_code','diapers_per_bag','bags_per_carton','opening_stock_ctns','per_diaper_rate','per_carton_rate'],['NB','UNREGISTERED','SMALL OZONE SO FIT-NB Bags-50*8','9619.0090',50,8,100,11.65,0]])}><Download className="h-3.5 w-3.5" /> Template</Button><input ref={productFile} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setProductCsv(await file.text()); e.target.value = '' }} /><Button variant="secondary" onClick={() => productFile.current?.click()}>Upload products_template.csv</Button></div><p className="mt-2 text-xs text-slate-500">{productCsv ? `${productRows(productCsv).length} product rows ready` : 'No file selected'}</p></Card>
              <Card title="Customers CSV"><div className="flex gap-2"><Button variant="secondary" onClick={() => downloadCsv('customers_template.csv', [['cnic_ntn','strn','business_name','delivery_destination','registration_status','income_tax_status','opening_balance','bank_account_no','bank_branch_name'],['1310203665017','5478763-4','SAMPLE TRADERS','Karachi, Pakistan','Unregister','Filer',0,'PK00BANK0000000000','Main Branch']])}><Download className="h-3.5 w-3.5" /> Template</Button><input ref={customerFile} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCustomerCsv(await file.text()); e.target.value = '' }} /><Button variant="secondary" onClick={() => customerFile.current?.click()}>Upload customers_template.csv</Button></div><p className="mt-2 text-xs text-slate-500">{customerCsv ? `${customerRows(customerCsv).length} customer rows ready` : 'No file selected'}</p></Card>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"><p className="font-bold">Build standalone client .exe</p><code className="mt-1 block rounded bg-white p-2 text-[11px]">npm run electron:build:company -- --company={companyForm.company_code || 'CODE'} --expiry={companyForm.license_expiry_date} --name="{companyForm.company_name || 'Company Name'}"</code></div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setWizard(false)}>Cancel</Button><Button onClick={() => void buildCompany()}>Build company &amp; download exe config</Button></div>
          </div>
        </Modal>
      )}

      {resetTarget && isSuper && (
        <Modal title="Factory Reset Company Data" onClose={() => { setResetTarget(null); setResetCode('') }}>
          <div className="space-y-4">
            <Notice type="warn"><ShieldAlert className="mr-1 inline h-4 w-4" /> This permanently deletes all vouchers in {resetTarget.company_code}_master_ledger, restores product stock to opening balances, and resets document sequences. Customers, products, companies, and users are preserved.</Notice>
            <div className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/70">Target company code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-rose-100">{String(resetTarget.company_code).toUpperCase()}</p>
              <p className="mt-1 text-xs text-slate-400">{resetTarget.company_name || 'Company'}</p>
            </div>
            <Field label={`Type ${String(resetTarget.company_code).toUpperCase()} to confirm`}>
              <input className="field-input uppercase" autoFocus autoComplete="off" spellCheck={false} disabled={busy} value={resetCode} onChange={(e) => setResetCode(e.target.value.toUpperCase())} placeholder={String(resetTarget.company_code).toUpperCase()} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => { setResetTarget(null); setResetCode('') }}>Cancel</Button>
              <Button variant="danger" onClick={() => void factoryReset()} disabled={busy || resetCode.trim().toUpperCase() !== String(resetTarget.company_code).toUpperCase()}>{busy ? 'Resetting…' : 'Confirm Factory Reset'}</Button>
            </div>
          </div>
        </Modal>
      )}


      {credential && (
        <Modal title={`Customer login — ${credential.customerName}`} onClose={() => setCredential(null)}>
          <div className="space-y-3">
            <Notice type="success">Credentials created and linked to this customer only.</Notice>
            <div className="grid grid-cols-2 gap-3 text-xs"><Field label="Username"><input className="field-input" readOnly value={credential.username} /></Field><Field label="Password"><input className="field-input" readOnly value={credential.password} /></Field><Field label="Direct login URL" className="col-span-2"><input className="field-input" readOnly value={credential.url} /></Field></div>
            <Field label="WhatsApp login message"><textarea className="field-input" rows={6} readOnly value={credential.message} /></Field>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCredential(null)}>Close</Button><Button onClick={() => void copyCredential()}><Copy className="h-3.5 w-3.5" /> Copy message &amp; URL</Button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
