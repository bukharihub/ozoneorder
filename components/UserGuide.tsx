'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Printer, X } from 'lucide-react'
import { useApp } from './AppProvider'
import { Button } from './Ui'

type Lang = 'en' | 'ur'
type GuideTable = { head: string[]; rows: string[][] }
type GuideSection = {
  heading: string
  paragraphs?: string[]
  steps?: string[]
  bullets?: string[]
  table?: GuideTable
}

const guide: Record<Lang, { title: string; subtitle: string; sections: GuideSection[] }> = {
  en: {
    title: 'OZONE Enterprise ERP — Master User Guide',
    subtitle: 'English guide for Super Admin, Company Admin, Store / FG, Accounts and Customer users.',
    sections: [
      {
        heading: '1. System overview & business benefits',
        paragraphs: [
          'OZONE Enterprise ERP is a multi-company, multi-user ERP for diaper and FMCG distribution. It runs at https://ozoneso.vercel.app and in a Windows desktop wrapper that opens the same web app. Data lives in Supabase Postgres, protected by 12-hour sessions, role permissions and row-level security.',
          'The document chain is strict: Sales Order → GDN / Gate Pass → Sales Tax Invoice → Bank Receipt → Customer Ledger & Reports. A document cannot be edited once its downstream document exists.'
        ],
        bullets: [
          'Solves paper vouchers, duplicate numbers, stock mismatches, manual tax errors, unclear receivables and staff seeing data outside their role.',
          'Atomic voucher numbers, live FG stock, automatic 18% / 4% / 236G tax, FIFO aging, A4 print-ready vouchers and customer self-service.',
          'Roles: SUPER_ADMIN, COMPANY_ADMIN, STORE_FG, ACCOUNTS, CUSTOMER.'
        ]
      },
      {
        heading: '2. Getting started & access',
        steps: [
          'Open https://ozoneso.vercel.app, or launch the OZONE Enterprise ERP desktop app (internet required; use Retry Connection if offline).',
          'Enter the Company Code (demo company: OZONE). Company verification is automatic.',
          'Enter your username and password, then click Sign in.',
          'Customer users land in the Customer Portal; all other roles land on the Dashboard with a role-filtered sidebar.',
          'Sessions last 12 hours. Use Change Password to update your own password and Sign out on shared computers.'
        ]
      },
      {
        heading: '3. Role-by-role operations',
        paragraphs: [
          'SUPER_ADMIN: full access. Use Company Master Control to suspend/activate, extend demos, convert to full licence and factory reset (type the exact company code). Only Super Admin can edit company profile, logo and licences. Confidential founder playbooks are owner-only.',
          'COMPANY_ADMIN: manage users, roles, permissions, customer logins, linked customers, hidden rates and lock bypass; use all voucher modules, stock, customers, ledger, reports and printing.',
          'STORE_FG: view/print sales orders; create, edit, delete and print GDN / Gate Pass. Posting a GDN deducts stock and updates the order status.',
          'ACCOUNTS: create sales tax invoices from unbilled GDNs, post bank receipts, review customer ledger and export aging/FG stock/Excel reports.',
          'CUSTOMER: use the Customer Portal to place orders for linked customers and track them live. Rates and amounts are hidden by design.'
        ],
        table: {
          head: ['Stage', 'Created by', 'Effect'],
          rows: [
            ['Sales Order', 'COMPANY_ADMIN / SUPER_ADMIN / CUSTOMER (linked)', 'Records cartons; no stock change.'],
            ['GDN / Gate Pass', 'STORE_FG / COMPANY_ADMIN / SUPER_ADMIN', 'Deducts FG stock; updates SO status.'],
            ['Sales Tax Invoice', 'ACCOUNTS / COMPANY_ADMIN / SUPER_ADMIN', 'Calculates tax and posts receivable.'],
            ['Bank Receipt', 'ACCOUNTS / COMPANY_ADMIN / SUPER_ADMIN', 'Posts payment and reduces balance.']
          ]
        }
      },
      {
        heading: '4. Reports, analytics, security & troubleshooting',
        bullets: [
          'Dashboard: orders, revenue, fulfilment, recovery, monthly value chart, customer segments and live system status cards.',
          'Reports: booker-wise ledger, aging buckets 0-30 / 31-60 / 61-90 / 90+ days, Ledger CSV and full Excel export.',
          'Security: company isolation, permission matrix, customer login limits, 12-hour sessions and hidden-rate accounts.',
          'Locks: vouchers older than 3 days or before the entry lock date are locked; downstream documents make records immutable.'
        ],
        table: {
          head: ['Problem', 'Action'],
          rows: [
            ['Auto-Locked (>3 Days)', 'Ask Company Admin/Super Admin or a bypass user; do not change the voucher date.'],
            ['Permission denied', 'Ask the administrator to update your role permissions.'],
            ['Insufficient stock', 'Reduce cartons or receive stock before dispatch.'],
            ['Blank rates', 'Hidden rates are enabled for your account.'],
            ['Demo expired', 'Contact the owner via the WhatsApp link on the lock screen.'],
            ['Desktop offline', 'Check internet, then click Retry Connection.']
          ]
        }
      }
    ]
  },
  ur: {
    title: 'OZONE Enterprise ERP — مکمل صارف گائیڈ',
    subtitle: 'سپر ایڈمن، کمپنی ایڈمن، اسٹور / FG، اکاؤنٹس اور کسٹمر صارفین کے لیے اردو گائیڈ۔',
    sections: [
      {
        heading: '1. سسٹم کا جائزہ اور کاروباری فوائد',
        paragraphs: [
          'OZONE Enterprise ERP ڈائپر اور FMCG ڈسٹری بیوشن کے لیے کثیر کمپنی، کثیر صارف ERP ہے۔ یہ https://ozoneso.vercel.app پر چلتا ہے اور اسی ویب ایپ کو ونڈوز ڈیسک ٹاپ ایپ کے ذریعے بھی استعمال کیا جا سکتا ہے۔ ڈیٹا Supabase Postgres میں محفوظ ہے، جسے 12 گھنٹے کے سیشنز، کردار کی اجازتیں اور row-level سیکیورٹی محفوظ رکھتے ہیں۔',
          'دستاویزات کا سلسلہ سختی سے طے شدہ ہے: Sales Order → GDN / Gate Pass → Sales Tax Invoice → Bank Receipt → Customer Ledger اور Reports۔ اگلی دستاویز بن جانے کے بعد پچھلی دستاویز میں ترمیم نہیں کی جا سکتی۔'
        ],
        bullets: [
          'کاغذی واؤچرز، نمبروں کی نقل، اسٹاک کا عدم توازن، ٹیکس کے دستی حسابات کی غلطیاں، بقایاجات کی غیر واضح صورتحال اور عملے کی اپنے کردار سے باہر ڈیٹا تک رسائی جیسے مسائل ختم ہوتے ہیں۔',
          'خودکار اور منفرد واؤچر نمبر، زندہ FG اسٹاک، 18% / 4% / 236G ٹیکس کا خودکار حساب، FIFO کے مطابق اسٹاک کی عمر (aging)، A4 پرنٹ کے لیے تیار واؤچرز اور کسٹمر کی خود سہولت۔',
          'کردار: SUPER_ADMIN، COMPANY_ADMIN، STORE_FG، ACCOUNTS، CUSTOMER۔'
        ]
      },
      {
        heading: '2. ابتدائی استعمال اور رسائی',
        steps: [
          'https://ozoneso.vercel.app کھولیں یا OZONE Enterprise ERP ڈیسک ٹاپ ایپ چلائیں (انٹرنیٹ ضروری ہے؛ آف لائن ہونے پر Retry Connection دبائیں)۔',
          'Company Code درج کریں (ڈیمو کمپنی: OZONE)۔ کمپنی کی تصدیق خودکار ہے۔',
          'صارف نام اور پاس ورڈ درج کریں، پھر Sign in دبائیں۔',
          'CUSTOMER صارف Customer Portal میں آتے ہیں، جبکہ باقی تمام کردار Dashboard پر پہنچتے ہیں جہاں سائیڈ بار ان کی اجازت کے مطابق فلٹر ہوتا ہے۔',
          'سیشن 12 گھنٹے تک رہتا ہے۔ اپنا پاس ورڈ تبدیل کرنے کے لیے Change Password اور مشترکہ کمپیوٹر پر Sign out استعمال کریں۔'
        ]
      },
      {
        heading: '3. کردار کے حساب سے آپریشنز',
        paragraphs: [
          'SUPER_ADMIN: مکمل رسائی۔ Company Master Control سے کمپنی کو معطل/فعال کریں، ڈیمو کی مدت بڑھائیں، مکمل لائسنس میں تبدیل کریں اور فیکٹری ری سیٹ کریں (کمپنی کوڈ بالکل ویسا ٹائپ کریں)۔ کمپنی پروفائل، لوگو اور لائسنس صرف Super Admin ہی تبدیل کر سکتا ہے۔ خفیہ founder playbooks صرف مالک کے لیے ہیں۔',
          'COMPANY_ADMIN: صارفین، کردار، اجازتیں، کسٹمر لاگ اِن، منسلک کسٹمرز، چھپی قیمتیں اور لاک بائی پاس کا انتظام کریں۔ تمام واؤچر ماڈیولز، اسٹاک، کسٹمرز، لیجر، رپورٹس اور پرنٹنگ استعمال کر سکتے ہیں۔',
          'STORE_FG: Sales Orders دیکھیں/پرنٹ کریں؛ GDN / Gate Pass بنائیں، ایڈٹ کریں، حذف کریں اور پرنٹ کریں۔ GDN پوسٹ ہوتے ہی اسٹاک کم ہوتا ہے اور آرڈر کی اسٹیٹس اپ ڈیٹ ہوتی ہے۔',
          'ACCOUNTS: غیر انوائس شدہ GDN سے Sales Tax Invoice بنائیں، Bank Receipt پوسٹ کریں، کسٹمر لیجر دیکھیں اور aging / FG اسٹاک / Excel رپورٹس برآمد کریں۔',
          'CUSTOMER: Customer Portal سے منسلک کسٹمرز کے لیے آرڈر دیں اور انہیں لائیو ٹریک کریں۔ قیمتیں اور رقم جان بوجھ کر چھپی رہتی ہیں۔'
        ],
        table: {
          head: ['مرحلہ', 'کس نے بنایا', 'اثر'],
          rows: [
            ['Sales Order', 'COMPANY_ADMIN / SUPER_ADMIN / CUSTOMER (منسلک)', 'کارٹن ریکارڈ ہوتے ہیں؛ اسٹاک تبدیل نہیں ہوتا۔'],
            ['GDN / Gate Pass', 'STORE_FG / COMPANY_ADMIN / SUPER_ADMIN', 'FG اسٹاک کم ہوتا ہے؛ Sales Order کی اسٹیٹس اپ ڈیٹ ہوتی ہے۔'],
            ['Sales Tax Invoice', 'ACCOUNTS / COMPANY_ADMIN / SUPER_ADMIN', 'ٹیکس حساب ہوتا ہے اور receivable پوسٹ ہوتا ہے۔'],
            ['Bank Receipt', 'ACCOUNTS / COMPANY_ADMIN / SUPER_ADMIN', 'ادائیگی پوسٹ ہوتی ہے اور بقایا کم ہوتا ہے۔']
          ]
        }
      },
      {
        heading: '4. رپورٹس، تجزیات، سیکیورٹی اور ٹربل شوٹنگ',
        bullets: [
          'Dashboard: آرڈرز، آمدنی، تکمیل، وصولی، ماہانہ ویلیو چارٹ، کسٹمر اقسام اور لائیو سسٹم اسٹیٹس کارڈز۔',
          'Reports: booker وار لیجر، aging سلیب 0-30 / 31-60 / 61-90 / 90+ دن، لیجر CSV اور مکمل Excel برآمد۔',
          'سیکیورٹی: کمپنیوں کی الگ تھلگ ڈیٹا حدود، اجازت میٹرکس، کسٹمر لاگ اِن کی پابندیاں، 12 گھنٹے سیشنز اور چھپی قیمتیں۔',
          'لاکس: 3 دن سے پرانی یا entry lock date سے پہلے کی دستاویزات بند ہو جاتی ہیں؛ اگلی دستاویز بننے پر پچھلی تبدیل نہیں ہو سکتی۔'
        ],
        table: {
          head: ['مسئلہ', 'حل'],
          rows: [
            ['Auto-Locked (>3 Days)', 'Company Admin / Super Admin یا bypass اجازت والے صارف سے رابطہ کریں؛ واؤچر کی تاریخ تبدیل نہ کریں۔'],
            ['Permission denied', 'ایڈمن سے اپنے کردار کی اجازتیں اپ ڈیٹ کروائیں۔'],
            ['Insufficient stock', 'کارٹن کم کریں یا ڈسپیچ سے پہلے اسٹاک وصول کریں۔'],
            ['Blank rates', 'آپ کے اکاؤنٹ پر چھپی قیمتیں فعال ہیں۔'],
            ['Demo expired', 'لاک اسکرین پر WhatsApp لنک سے مالک سے رابطہ کریں۔'],
            ['Desktop offline', 'انٹرنیٹ چیک کریں، پھر Retry Connection دبائیں۔']
          ]
        }
      }
    ]
  }
}

const BRAND = 'Syed Shoaib Ali Shah Bukhari (Bukharihub) • © 2026 All Rights Reserved'

function GuideContent({ lang }: { lang: Lang }) {
  const data = guide[lang]
  const isUrdu = lang === 'ur'
  return (
    <div dir={isUrdu ? 'rtl' : 'ltr'} lang={isUrdu ? 'ur-PK' : 'en'} className={`space-y-5 ${isUrdu ? 'guide-urdu text-right' : ''}`}>
      <div>
        <h2 className="text-base font-bold text-cyan-50">{data.title}</h2>
        <p className="mt-1 text-[11px] text-slate-400">{data.subtitle}</p>
        <p className="mt-2 text-[11px] font-semibold text-cyan-300">{BRAND}</p>
      </div>
      {data.sections.map((section) => (
        <section key={section.heading} className="glass-static rounded-xl p-4">
          <h3 className="text-sm font-bold text-cyan-100">{section.heading}</h3>
          {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-2 text-xs text-slate-300">{paragraph}</p>)}
          {section.bullets && (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-slate-300">
              {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          )}
          {section.steps && (
            <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-slate-300">
              {section.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          )}
          {section.table && (
            <div className="app-scroll mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-start text-[11px]">
                <thead><tr className="table-head">{section.table.head.map((head) => <th key={head} className="border border-cyan-400/20 px-2 py-1">{head}</th>)}</tr></thead>
                <tbody>{section.table.rows.map((row) => (
                  <tr key={row[0]} className="table-row">{row.map((cell, index) => <td key={`${row[0]}-${index}`} className="border border-cyan-400/15 px-2 py-1 align-top">{cell}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

export function UserGuide() {
  const { session, showPrint } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const isUrdu = lang === 'ur'

  const closeGuide = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeGuide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [isOpen])

  if (!session) return null

  const printable = (
    <div dir={isUrdu ? 'rtl' : 'ltr'} lang={isUrdu ? 'ur-PK' : 'en'} className={`guide-print ${isUrdu ? 'guide-urdu text-right' : ''}`} style={{ background: '#fff', color: '#000' }}>
      <GuideContent lang={lang} />
    </div>
  )

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen((value) => !value)} aria-label="Open user guide" aria-expanded={isOpen}>
        <BookOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">User Guide</span>
      </Button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/80 p-3 backdrop-blur-sm sm:p-5" onClick={closeGuide}>
          <div role="dialog" aria-modal="true" aria-label="User Guide / صارف گائیڈ" onClick={(event) => event.stopPropagation()} className="glass-panel flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#0f172a]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 bg-slate-950/95 px-4 py-3">
              <h2 className="min-w-0 truncate text-sm font-bold text-cyan-50">User Guide / صارف گائیڈ</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-cyan-400/30 bg-slate-900/85 p-0.5" aria-label="Guide language">
                  <button type="button" onClick={() => setLang('en')} aria-pressed={!isUrdu} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${!isUrdu ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-400 hover:text-cyan-100'}`}>English</button>
                  <button type="button" onClick={() => setLang('ur')} aria-pressed={isUrdu} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${isUrdu ? 'bg-cyan-400/20 text-cyan-100' : 'text-slate-400 hover:text-cyan-100'}`}>اردو</button>
                </div>
                <Button variant="ghost" onClick={closeGuide} aria-label="Close user guide" className="px-2"><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex items-center justify-end border-b border-cyan-400/15 bg-slate-950/70 px-4 py-2">
              <Button variant="secondary" onClick={() => showPrint(printable)}><Printer className="h-3.5 w-3.5" /> Print / Save PDF</Button>
            </div>
            <div className="app-scroll flex-1 overflow-auto p-4">
              <GuideContent lang={lang} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
