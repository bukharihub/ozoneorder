import { useState, type ReactNode } from 'react'
import { Pencil, Printer, Trash2 } from 'lucide-react'
import { deleteRow, updateRow } from '../lib/api'
import type { Row } from '../lib/types'
import { useApp } from './AppContext'
import { Button, Field, Input, Modal, Textarea } from './ui'

export interface EditField {
  key: string
  label: string
  type?: 'text' | 'date' | 'number' | 'textarea'
}

export const VoucherActions = ({
  table,
  row,
  label,
  editFields,
  onPrint,
  onChanged,
  extra,
}: {
  table: string
  row: Row
  label: string
  editFields: EditField[]
  onPrint: () => void
  onChanged?: () => void
  extra?: ReactNode
}) => {
  const { permissions, notify, refresh } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Row>({})
  const [saving, setSaving] = useState(false)

  const openEdit = () => {
    setDraft(Object.fromEntries(editFields.map((field) => [field.key, row[field.key] ?? ''])))
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const patch = Object.fromEntries(
        editFields.map((field) => [
          field.key,
          field.type === 'number' ? Number(draft[field.key] || 0) : draft[field.key] || '',
        ]),
      )
      await updateRow(table, row.id, patch)
      notify(`${label} updated`)
      setEditing(false)
      refresh()
      onChanged?.()
    } catch (cause: any) {
      notify(cause?.message || `Unable to update ${label}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const confirmed = window.confirm(
      `Delete ${label} ${row.document_number || row.quotation_number || row.order_number || row.gdn_number || row.gate_pass_number || row.invoice_number || row.receipt_number || row.id}?\n\nFG stock, invoice totals and customer ledger balances will be recalculated automatically. This cannot be undone.`,
    )
    if (!confirmed) return
    try {
      await deleteRow(table, row.id)
      notify(`${label} deleted`, 'info')
      refresh()
      onChanged?.()
    } catch (cause: any) {
      notify(cause?.message || `Unable to delete ${label}`, 'error')
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {extra}
        {permissions.printVouchers && (
          <Button size="sm" variant="secondary" onClick={onPrint}>
            <Printer size={13} /> Print
          </Button>
        )}
        {permissions.editVouchers && (
          <Button size="sm" variant="secondary" onClick={openEdit}>
            <Pencil size={13} /> Edit
          </Button>
        )}
        {permissions.deleteVouchers && (
          <Button size="sm" variant="danger" onClick={() => void remove()}>
            <Trash2 size={13} /> Delete
          </Button>
        )}
      </div>

      <Modal open={editing} title={`Edit ${label}`} onClose={() => setEditing(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {editFields.map((field) => (
            <Field key={field.key} label={field.label} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
              {field.type === 'textarea' ? (
                <Textarea
                  value={String(draft[field.key] ?? '')}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
              ) : (
                <Input
                  type={field.type || 'text'}
                  value={String(draft[field.key] ?? '')}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </>
  )
}
