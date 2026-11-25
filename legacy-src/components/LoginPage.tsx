import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { authenticate } from '../lib/api'
import { embeddedLicense, isCompanyLockedBuild } from '../lib/license'
import type { AppSession } from '../lib/types'
import { Button, Card, Field, Input } from './ui'

export const LoginPage = ({ onSuccess }: { onSuccess: (session: AppSession) => void }) => {
  const lockedBuild = isCompanyLockedBuild()
  const [companyCode, setCompanyCode] = useState('')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await authenticate(lockedBuild ? embeddedLicense.companyCode : companyCode, loginId, password)
      onSuccess(session)
    } catch (cause: any) {
      setError(cause?.message || 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_0%,#164e6322,transparent_50%),#020617] p-4">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10">
            <LockKeyhole size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-white">Sale Order Console</h1>
          <p className="mt-1.5 text-sm text-slate-400">Enterprise Order, Stock &amp; Ledger Management</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 p-7 shadow-2xl shadow-black/40 backdrop-blur">
          {lockedBuild && (
            <div className="mb-5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-center text-xs font-semibold text-cyan-200">
              Licensed desktop build · {embeddedLicense.companyName || embeddedLicense.companyCode}
            </div>
          )}

          <form className="space-y-5" onSubmit={submit} autoComplete="off">
            <Field label="Company / Customer Code">
              {lockedBuild ? (
                <div className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  {embeddedLicense.companyName || embeddedLicense.companyCode}
                </div>
              ) : (
                <Input
                  value={companyCode}
                  onChange={(event) => setCompanyCode(event.target.value)}
                  placeholder="Company code"
                  required
                />
              )}
            </Field>
            <Field label="Login ID / CNIC">
              <Input
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="Login ID or CNIC"
                required
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-cyan-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm leading-5 text-rose-300">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full py-2.5" disabled={loading}>
              {loading ? 'Verifying access…' : 'Access Sale Order Console'}
            </Button>
          </form>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-600">
          <ShieldCheck size={13} />
          Authorized users only · Multi-tenant licensed workspace
        </div>
      </div>
    </div>
  )
}
