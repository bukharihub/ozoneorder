import { LockKeyhole } from 'lucide-react'
import type { LockoutInfo } from '../lib/types'
import { Button } from './ui'

export const LicenseLockout = ({ info, onBack }: { info: LockoutInfo; onBack: () => void }) => (
  <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#7f1d1d33,transparent_55%),#020617] p-4">
    <div className="w-full max-w-2xl text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-rose-500/40 bg-rose-500/10 text-rose-300 shadow-2xl shadow-rose-900/30">
        <LockKeyhole size={40} />
      </div>
      <h1 className="mt-7 text-3xl font-black leading-tight text-rose-300 sm:text-4xl">
        System Access Locked — Company License Expired
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-200">
        Your 40-day software license has expired and system access has been disabled. Please contact the software
        administrator to renew your license.
      </p>

      <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-left">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Company Name</div>
            <div className="mt-1 font-semibold text-white">{info.companyName || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Company Code</div>
            <div className="mt-1 font-semibold text-white">{info.companyCode || '—'}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {info.reason === 'suspended' ? 'License Status' : 'Expired Date'}
            </div>
            <div className="mt-1 font-semibold text-rose-300">
              {info.reason === 'suspended' ? 'Suspended' : info.expiryDate || '—'}
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-rose-500/20 pt-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vendor Renewal Contact</div>
          <div className="mt-1 text-sm font-semibold text-cyan-200">{info.supportContact}</div>
        </div>
      </div>

      <Button className="mt-8 px-8 py-2.5" onClick={onBack}>
        Back to Login
      </Button>
    </div>
  </div>
)
