import { Button, Card } from './ui'
import { useApp } from './AppContext'
import { dateLabel, money, num, titleCase } from '../lib/format'
import type { Row } from '../lib/types'

const meta = (label: string, value: any) => (
  <div className="flex gap-2 text-[12px]">
    <span className="font-bold text-slate-500">{label}:</span>
    <span>{value || '—'}</span>
  </div>
)

export const PrintDocument = ({
  title,
  doc,
  items,
  onClose,
  options,
}: {
  title: string
  doc: Row
  items: Row[]
  onClose: () => void
  options?: Row
}) => {
  const { session, permissions } = useApp()
  const company = session.company
  const viewOptions = options || {}
  const visible = permissions.viewValues
  const showRates = permissions.viewRates && viewOptions.show_rates !== false
  const showBags = viewOptions.show_bags !== false
  const showTotals = viewOptions.show_totals !== false
  const fullDescription = viewOptions.description_mode === 'full'
  const bagMode = viewOptions.quantity_mode === 'cartons_bags_pcs_per_carton'
  const amount = (value: any) => money(value, visible)

  const itemRows = items.map((item, index) => ({
    sr: index + 1,
    name: fullDescription
      ? item.full_kind_name || item.invoice_short_name || item.description || ''
      : item.invoice_short_name || item.full_kind_name || item.description || '',
    hs: item.hs_code || session.settings.default_hs_code || '',
    qty: item.qty_cartons,
    cnts_size: item.cnts_size,
    bags_size: item.bags_size,
    packing: `${num(item.cnts_size)} × ${num(item.bags_size)}`,
    bags: item.bags_qty,
    diapers: item.diapers_pcs,
    rate: item.rate_per_carton,
    net: item.net_total,
  }))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm no-print">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex justify-end gap-2 no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
        <Card className="print-area bg-white p-8 text-black">
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
            <div>
              <div className="text-2xl font-black tracking-tight">{company.company_name}</div>
              <div className="mt-1 text-xs leading-5">
                {company.address}, {company.city}, {company.country}
                <br />
                NTN/STRN: {company.ntn_strn || '—'}
              </div>
            </div>
            <div className="text-right text-xs leading-5">
              {company.logo_text || <span className="text-lg font-black text-slate-700">OZONE</span>}
              <br />
              {company.bank_name}
              <br />
              {company.bank_account}
            </div>
          </div>

          <div className="mt-5 text-center text-xl font-black uppercase tracking-widest">{title}</div>

          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 rounded border border-slate-300 bg-slate-50 p-4">
            {meta('Document No', doc.invoice_number || doc.quotation_number || doc.gdn_number || doc.gate_pass_number || doc.receipt_number || doc.order_number)}
            {meta('Date', dateLabel(doc.invoice_date || doc.quotation_date || doc.order_date || doc.gdn_date || doc.passage_date || doc.receipt_date))}
            {meta('Customer', doc.customer_name)}
            {meta('Customer Type', titleCase(doc.customer_type))}
            {meta('Reg No', doc.reg_no)}
            {meta('Filer Status', doc.filer_status)}
            {meta('CNIC/NTN', doc.cnic_ntn)}
            {meta('STRN', doc.strn)}
            {meta('Delivery Address', doc.delivery_destination_address)}
            {meta('Vehicle', doc.vehicle_no || doc.vehicle_number)}
            {meta('Driver', doc.driver_name)}
            {meta('Driver CNIC', doc.driver_cnic)}
          </div>

          {items.length > 0 && (
            <table className="mt-6 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border border-slate-400 bg-slate-100 text-left uppercase">
                  <th className="border border-slate-300 px-2 py-2">#</th>
                  <th className="border border-slate-300 px-2 py-2">Description</th>
                  <th className="border border-slate-300 px-2 py-2">HS</th>
                  <th className="border border-slate-300 px-2 py-2">Cartons</th>
                  <th className="border border-slate-300 px-2 py-2">Packing</th>
                  {showBags && <th className="border border-slate-300 px-2 py-2">Bags</th>}
                  <th className="border border-slate-300 px-2 py-2">{bagMode ? 'Pcs/Carton' : 'Diapers'}</th>
                  {showRates && <th className="border border-slate-300 px-2 py-2">Rate</th>}
                  {visible && <th className="border border-slate-300 px-2 py-2">Net</th>}
                </tr>
              </thead>
              <tbody>
                {itemRows.map((item) => (
                  <tr key={item.sr}>
                    <td className="border border-slate-300 px-2 py-2">{item.sr}</td>
                    <td className="border border-slate-300 px-2 py-2">{item.name}</td>
                    <td className="border border-slate-300 px-2 py-2">{item.hs}</td>
                    <td className="border border-slate-300 px-2 py-2">{num(item.qty)}</td>
                    <td className="border border-slate-300 px-2 py-2">{item.packing}</td>
                    {showBags && <td className="border border-slate-300 px-2 py-2">{num(item.bags)}</td>}
                    <td className="border border-slate-300 px-2 py-2">{num(bagMode ? Number(item.cnts_size || 0) * Number(item.bags_size || 0) : item.diapers)}</td>
                    {showRates && <td className="border border-slate-300 px-2 py-2">{money(item.rate)}</td>}
                    {visible && <td className="border border-slate-300 px-2 py-2">{money(item.net)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {visible && showTotals && (
            <div className="mt-6 ml-auto w-full max-w-sm space-y-1 text-[12px]">
              <div className="flex justify-between border-b border-slate-300 py-1">
                <span>Subtotal</span>
                <span>{amount(doc.subtotal)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300 py-1">
                <span>Sales Tax ({num(doc.sales_tax_rate || 18)}%)</span>
                <span>{amount(doc.sales_tax)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300 py-1">
                <span>Further Tax ({num(doc.further_tax_rate)}%)</span>
                <span>{amount(doc.further_tax)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-300 py-1">
                <span>Sec 236G ({num(doc.sec236g_rate)}%)</span>
                <span>{amount(doc.sec236g_amount)}</span>
              </div>
              <div className="flex justify-between border-2 border-slate-800 bg-slate-100 px-2 py-2 text-sm font-black">
                <span>Net Total</span>
                <span>{amount(doc.net_total ?? doc.net_receipt_total)}</span>
              </div>
              {doc.paid_amount !== undefined && (
                <div className="flex justify-between border-b border-slate-300 py-1">
                  <span>Paid / Balance</span>
                  <span>
                    {amount(doc.paid_amount)} / {amount(doc.balance_amount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {doc.remark && <div className="mt-6 text-[12px]">Remarks: {doc.remark}</div>}
          {doc.remarks && <div className="mt-6 text-[12px]">Remarks: {doc.remarks}</div>}

          <div className="mt-14 grid grid-cols-3 gap-8 text-center text-[11px]">
            <div className="border-t border-slate-500 pt-2">Prepared By</div>
            <div className="border-t border-slate-500 pt-2">Authorized By</div>
            <div className="border-t border-slate-500 pt-2">Received By</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
