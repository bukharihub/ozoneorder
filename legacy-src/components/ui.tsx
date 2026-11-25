import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export const cn = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ')

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = ({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => (
  <button
    {...props}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
      variant === 'primary' && 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
      variant === 'secondary' && 'border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/60 hover:text-white',
      variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
      variant === 'ghost' && 'text-slate-300 hover:bg-slate-800 hover:text-white',
      className,
    )}
  />
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20', className)}>
    {children}
  </div>
)

type FieldProps = { label: string; children: ReactNode; hint?: string; className?: string }

export const Field = ({ label, children, hint, className = '' }: FieldProps) => (
  <label className={cn('block space-y-1.5', className)}>
    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
  </label>
)

const controlClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20'

export const Input = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn(controlClass, className)} />
)

export const Select = ({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn(controlClass, className)}>
    {children}
  </select>
)

export const Textarea = ({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cn(controlClass, 'min-h-24 resize-y', className)} />
)

export const Badge = ({
  children,
  tone = 'slate',
}: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo'
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
      tone === 'slate' && 'bg-slate-800 text-slate-300',
      tone === 'green' && 'bg-emerald-500/15 text-emerald-300',
      tone === 'amber' && 'bg-amber-500/15 text-amber-300',
      tone === 'red' && 'bg-rose-500/15 text-rose-300',
      tone === 'indigo' && 'bg-indigo-500/15 text-indigo-300',
    )}
  >
    {children}
  </span>
)

export const Empty = ({ text = 'No records found' }: { text?: string }) => (
  <div className="px-4 py-12 text-center text-sm text-slate-500">{text}</div>
)

export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  className?: string
  headClassName?: string
}

export const Table = <T,>({
  columns,
  rows,
  rowKey,
  emptyText,
}: {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string
  emptyText?: string
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
      <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
        <tr>
          {columns.map((column) => (
            <th key={column.key} className={cn('whitespace-nowrap px-4 py-3 font-semibold', column.headClassName)}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/80">
        {rows.map((row) => (
          <tr key={rowKey(row)} className="transition hover:bg-slate-800/40">
            {columns.map((column) => (
              <td key={column.key} className={cn('whitespace-nowrap px-4 py-3 text-slate-300', column.className)}>
                {column.render ? column.render(row) : String((row as any)?.[column.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {!rows.length && <Empty text={emptyText} />}
  </div>
)

export const Modal = ({
  open,
  title,
  onClose,
  children,
  width = 'max-w-3xl',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: string
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm no-print">
      <div className={cn('w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl', width)}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

export const Stat = ({ label, value, tone = 'cyan' }: { label: string; value: ReactNode; tone?: string }) => (
  <Card className="p-4">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={cn('mt-2 text-2xl font-bold', tone === 'cyan' ? 'text-cyan-300' : 'text-slate-100')}>{value}</div>
  </Card>
)

export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
)

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card className="p-5">
    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">{title}</h3>
    {children}
  </Card>
)
