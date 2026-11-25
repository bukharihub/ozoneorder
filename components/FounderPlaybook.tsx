'use client'

import React, { useState } from 'react'
import { Printer, ShieldCheck } from 'lucide-react'
import { getSession } from '@/lib/session'
import type { FounderPlaybookData, PlaybookSection } from '@/lib/playbookTypes'
import { useApp } from './AppProvider'
import { Button, Modal, Notice } from './Ui'

type Lang = 'en' | 'ur'
const BRAND = 'Syed Shoaib Ali Shah Bukhari (Bukharihub) • © 2026 All Rights Reserved'

function Section({ section, lang }: { section: PlaybookSection; lang: Lang }) {
  const title = lang === 'en' ? section.titleEn : section.titleUr
  const paragraphs = lang === 'en' ? section.paragraphsEn : section.paragraphsUr
  const bullets = lang === 'en' ? section.bulletsEn : section.bulletsUr
  const table = lang === 'en' ? section.tableEn : section.tableUr
  return (
    <section className="glass-static rounded-xl p-4">
      <h3 className="text-sm font-bold text-cyan-100">{title}</h3>
      {paragraphs.map((paragraph) => <p key={paragraph} className="mt-2 text-xs leading-relaxed text-slate-300">{paragraph}</p>)}
      {bullets && (
        <ul className="mt-2 list-disc space-y-1 ps-5 text-xs leading-relaxed text-slate-300">
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      )}
      {table && (
        <div className="app-scroll mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
            <thead><tr className="table-head">{table.head.map((head) => <th key={head} className="border border-cyan-400/20 px-2 py-1">{head}</th>)}</tr></thead>
            <tbody>{table.rows.map((row) => (
              <tr key={row[0]} className="table-row">{row.map((cell, index) => <td key={`${row[0]}-${index}`} className="border border-cyan-400/15 px-2 py-1 align-top">{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function FounderPlaybook() {
  const { session, showPrint } = useApp()
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [data, setData] = useState<FounderPlaybookData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!session || session.user.role !== 'SUPER_ADMIN') return null

  const load = async () => {
    setLoading(true); setError('')
    try {
      const token = getSession()?.token || ''
      const response = await fetch('/api/founder-playbook/', { headers: { 'x-ozone-session': token }, cache: 'no-store' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Access denied (${response.status})`)
      }
      setData(await response.json() as FounderPlaybookData)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the confidential playbook')
    } finally { setLoading(false) }
  }

  const openPlaybook = () => {
    setOpen(true)
    if (!data && !loading) void load()
  }

  const printable = data ? (
    <div dir={lang === 'ur' ? 'rtl' : 'ltr'} lang={lang === 'ur' ? 'ur-PK' : 'en'} className="guide-print" style={{ background: '#fff', color: '#000', fontFamily: lang === 'ur' ? '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Gulzar", serif' : 'Arial, sans-serif', lineHeight: lang === 'ur' ? 2 : 1.6 }}>
      <div style={{ border: '2px solid #000', padding: '8px', marginBottom: '12px', fontWeight: 800, textAlign: 'center' }}>{lang === 'en' ? data.warningEn : data.warningUr}</div>
      <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>OZONE Enterprise ERP — Confidential Founder Playbook</h1>
      <p style={{ fontSize: '11px' }}>{BRAND}</p>
      {data.sections.map((section) => <Section key={section.id} section={section} lang={lang} />)}
    </div>
  ) : null

  return (
    <>
      <Button variant="ghost" onClick={openPlaybook} aria-label="Open confidential founder playbook"><ShieldCheck className="h-3.5 w-3.5" /> <span className="hidden md:inline">Founder Playbook</span></Button>
      {open && (
        <Modal title="Confidential Founder Playbook" wide onClose={() => setOpen(false)}>
          <div className="space-y-3">
            {error && <Notice type="error">Confidential playbook access denied: {error}</Notice>}
            {!error && !data && <Notice type="info">{loading ? 'Verifying master access…' : 'Master access is required to view this section.'}</Notice>}
            <div className="print-hidden flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button variant={lang === 'en' ? 'primary' : 'secondary'} onClick={() => setLang('en')}>English</Button>
                <Button variant={lang === 'ur' ? 'primary' : 'secondary'} onClick={() => setLang('ur')}>اردو</Button>
              </div>
              <Button variant="secondary" disabled={!data} onClick={() => printable && showPrint(printable)}><Printer className="h-3.5 w-3.5" /> Print / Save PDF</Button>
            </div>
            {data && (
              <div dir={lang === 'ur' ? 'rtl' : 'ltr'} lang={lang === 'ur' ? 'ur-PK' : 'en'} className="glass-static max-h-[65vh] space-y-3 overflow-auto rounded-xl p-4">
                <Notice type="error">{lang === 'en' ? data.warningEn : data.warningUr}</Notice>
                <h2 className="text-base font-bold text-cyan-50">OZONE Enterprise ERP — Confidential Founder Playbook</h2>
                <p className="text-[11px] font-semibold text-cyan-300">{BRAND}</p>
                {data.sections.map((section) => <Section key={section.id} section={section} lang={lang} />)}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
