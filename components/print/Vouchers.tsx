'use client'

import React from 'react'
import { amountInWords } from '@/lib/calc'
import { dateDMY, money, quantity } from '@/lib/format'
import type { LedgerRow, SessionCompany } from '@/lib/types'
import { CompanyLogo } from '../CompanyLogo'

const Header = ({ company, right }: { company: SessionCompany; right: React.ReactNode }) => (
  <div className="mb-2 flex items-start justify-between gap-6 border-b border-black pb-2">
    <div className="flex items-start gap-3">
      <CompanyLogo url={company.logo_url} companyCode={company.company_code} companyName={company.company_name} className="voucher-header-logo" />
      <div>
        <p className="text-base font-extrabold uppercase tracking-wide text-blue-800">{company.company_name}</p>
        <p>{company.city_country}</p>
        <p>NTN / STRN : {company.ntn_strn}</p>
        <p>Bank Account: {company.bank_details}</p>
      </div>
    </div>
    <div className="text-right">
      {right}
    </div>
  </div>
)

const Signatures = ({ left, middle, right }: { left: string; middle?: string; right: string }) => (
  <div className="signature-row flex items-end justify-between gap-8">
    <div className="signature-box w-40">
      <div className="signature-space" />
      <div className="signature-line">{left}</div>
    </div>
    {middle && <div className="signature-box w-40"><div className="signature-space" /><div className="signature-line">{middle}</div></div>}
    <div className="signature-box w-52"><div className="signature-space" /><div className="signature-line">{right}</div></div>
  </div>
)

const Summary = ({ row, hideRates = false }: { row: LedgerRow; hideRates?: boolean }) => {
  const value = (amount: any) => hideRates ? '—' : money(amount)
  return (
    <table className="voucher-summary ml-auto mt-2 w-[62%]">
      <tbody>
        <tr><td className="label">Total Exclusive Value</td><td className="value">{value(row.total_exclusive_value)}</td></tr>
        <tr><td className="label">Sales Tax (18%)</td><td className="value">{value(row.sales_tax_18)}</td></tr>
        <tr>
          <td className="label">Further Tax (4%)</td>
          <td className={`value ${row.further_tax_4 === 0 ? 'text-red-600' : ''}`}>{value(row.further_tax_4)}</td>
        </tr>
        <tr><td className="label">Amount Before 236G</td><td className="value">{value(row.amount_before_236g)}</td></tr>
        <tr>
          <td className="label">Advance Tax Under Section 236G ({Number(row.advance_tax_236g && row.amount_before_236g ? (row.advance_tax_236g / row.amount_before_236g * 100).toFixed(2) : '0.10')}%)</td>
          <td className="value">{value(row.advance_tax_236g)}</td>
        </tr>
        <tr className="voucher-total-row">
          <td className="label" style={{ background: '#111c3a', color: '#fff', padding: '4px 6px' }}>Net Bank Receipt Total</td>
          <td className="value" style={{ background: '#111c3a', color: '#fff', padding: '4px 6px' }}>{value(row.net_invoice_total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

const ItemTable = ({ row, rateLabel, hideRates = false }: { row: LedgerRow; rateLabel: string; hideRates?: boolean }) => (
  <table className="voucher-table mt-2">
    <thead>
      <tr>
        <th className="w-[34%]">Product Description</th>
        <th className="w-[12%]">HS Code</th>
        <th className="w-[9%]">Cartons</th>
        <th className="w-[9%]">Pcs</th>
        <th className="w-[16%]">{hideRates ? '—' : rateLabel}</th>
        <th className="w-[20%]">Exclusive Value</th>
      </tr>
    </thead>
    <tbody>
      {row.line_items.map((item, index) => (
        <tr key={`${item.product_id}-${index}`}>
          <td>{item.product_name}</td>
          <td>{item.hs_code}</td>
          <td className="text-right">{quantity(item.ordered_ctns || item.delivered_ctns)}</td>
          <td className="text-right">{quantity(item.pcs)}</td>
          <td className="text-right">{hideRates ? '—' : money(item.rate, 3)}</td>
          <td className="text-right">{hideRates ? '—' : money(item.exclusive_value)}</td>
        </tr>
      ))}
      <tr>
        <td colSpan={2} className="text-right font-bold">TOTAL</td>
        <td className="text-right font-bold">{quantity(row.total_cartons)}</td>
        <td className="text-right font-bold">{quantity(row.total_pcs)}</td>
        <td />
        <td className="text-right font-bold">{hideRates ? '—' : money(row.total_exclusive_value)}</td>
      </tr>
    </tbody>
  </table>
)

export function PrintSalesOrder({ company, row, hideRates = false }: { company: SessionCompany; row: LedgerRow; hideRates?: boolean }) {
  const rateLabel = row.registration_status === 'Unregister' ? 'Per Diaper Rate' : 'Per Carton Rate'
  return (
    <div className="voucher">
      <Header
        company={company}
        right={<><p className="text-sm font-bold">Sales Order No : {row.voucher_no}</p><p>Date: {dateDMY(row.voucher_date)}</p></>}
      />
      <div className="voucher-title">SALES ORDER</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="voucher-box p-2">
          <p className="font-bold">CUSTOMER INFORMATION:</p>
          <p>Business Name: {row.customer_name}</p>
          <p>Delivery Destination: {row.ship_to_address}</p>
          {row.booked_by_name && <p>Booker / Agent: {row.booked_by_name}</p>}
        </div>
        <div className="voucher-box p-2">
          <p className="font-bold">TAXATION &amp; COMPLIANCE CREDENTIALS:</p>
          <p>CNIC / NTN: {row.cnic_ntn}</p>
          <p>S.T Reg No: {row.strn}</p>
          <p>FBR Status: {row.filer_status}</p>
        </div>
      </div>
      <ItemTable row={row} rateLabel={rateLabel} hideRates={hideRates} />
      <Summary row={row} hideRates={hideRates} />
      <p className="mt-3"><strong>Amount In Words:</strong> PKR {hideRates ? '—' : amountInWords(row.net_invoice_total)} Only</p>
      <Signatures left="Prepared By" middle="Store Keeper" right="Receiver Seal & Sign" />
    </div>
  )
}

export function PrintInvoice({ company, row, hideRates = false, title }: { company: SessionCompany; row: LedgerRow; hideRates?: boolean; title?: string }) {
  const rateLabel = row.registration_status === 'Unregister' ? 'Per Diaper Rate' : 'Per Carton Rate'
  return (
    <div className="voucher">
      <Header
        company={company}
        right={<><p className="text-sm font-bold">Invoice Number: {row.voucher_no}</p><p>Invoice Date: {dateDMY(row.voucher_date)}</p></>}
      />
      <div className="voucher-title">{title || 'SALES TAX INVOICE (SEC 23 SALES TAX ACT 1990)'}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="voucher-box p-2">
          <p className="font-bold">CUSTOMER INFORMATION:</p>
          <p>Business Name: {row.customer_name}</p>
          <p>Delivery Destination: {row.ship_to_address}</p>
        </div>
        <div className="voucher-box p-2">
          <p className="font-bold">TAXATION &amp; COMPLIANCE CREDENTIALS:</p>
          <p>CNIC / NTN: {row.cnic_ntn}</p>
          <p>S.T Reg No: {row.strn}</p>
          <p>FBR Status: {row.filer_status}</p>
        </div>
      </div>
      <ItemTable row={row} rateLabel={rateLabel} hideRates={hideRates} />
      <Summary row={row} hideRates={hideRates} />
      <p className="mt-3"><strong>Amount In Words:</strong> PKR {hideRates ? '—' : amountInWords(row.net_invoice_total)} Only</p>
      <Signatures left="Prepared By" middle="Store Keeper" right="Receiver Seal & Sign" />
    </div>
  )
}

export const PrintInvoiceRegistered = ({ company, row, hideRates = false }: { company: SessionCompany; row: LedgerRow; hideRates?: boolean }) => (
  <PrintInvoice company={company} row={row} hideRates={hideRates} title="SALES TAX INVOICE — REGISTERED (SEC 23 SALES TAX ACT 1990)" />
)

export const PrintInvoiceUnregistered = ({ company, row, hideRates = false }: { company: SessionCompany; row: LedgerRow; hideRates?: boolean }) => (
  <PrintInvoice company={company} row={row} hideRates={hideRates} title="SALES TAX INVOICE — UNREGISTERED (SEC 23 SALES TAX ACT 1990)" />
)

export function PrintGdn({ company, row }: { company: SessionCompany; row: LedgerRow }) {
  return (
    <div className="voucher">
      <Header
        company={company}
        right={
          <>
            <p className="text-sm font-bold">Gate Pass No: {row.voucher_no}</p>
            <p>Linked GDN: {row.linked_gdn_no || row.linked_so_no}</p>
            <p>Date: {dateDMY(row.voucher_date)}</p>
          </>
        }
      />
      <p className="mb-2 text-right">Gate Security Control &amp; Logistics Dispatch</p>
      <div className="voucher-banner">GOODS DELIVERY NOTE (GDN) &amp; GATE PASS VOUCHER</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="voucher-box p-2">
          <p className="font-bold">CONSIGNEE / BUYER:</p>
          <p>Bill To: {row.customer_name}</p>
          <p>Destination: {row.ship_to_address}</p>
        </div>
        <div className="voucher-box p-2">
          <p className="font-bold">Ship To:</p>
          <p>{row.ship_to_name || row.customer_name}</p>
          <p>Delivery Destination: {row.ship_to_address}</p>
        </div>
      </div>
      <table className="voucher-table mt-2">
        <thead>
          <tr>
            <th className="w-[8%]">S.No</th>
            <th>Approved Consignment Item</th>
            <th className="w-[16%]">Total Cartons</th>
            <th className="w-[16%]">Total Units</th>
          </tr>
        </thead>
        <tbody>
          {row.line_items.map((item, index) => (
            <tr key={`${item.product_id}-${index}`}>
              <td className="text-center">{index + 1}</td>
              <td>{item.product_name}</td>
              <td className="text-right">{quantity(item.delivered_ctns)}</td>
              <td className="text-right">{quantity(item.pcs)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="text-right font-bold">CONSIGNMENT TOTAL</td>
            <td className="text-right font-bold">{quantity(row.total_cartons)}</td>
            <td className="text-right font-bold">{quantity(row.total_pcs)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 font-bold">Authorized Dispatch Vehicles</p>
      <table className="voucher-table mt-1">
        <thead><tr><th>Vehicle</th><th>Driver</th><th>Remarks</th></tr></thead>
        <tbody>
          <tr><td>{row.vehicle_1}</td><td>{row.driver_1}</td><td>{row.remarks_1}</td></tr>
          <tr><td>{row.vehicle_2}</td><td>{row.driver_2}</td><td>{row.remarks_2}</td></tr>
        </tbody>
      </table>
      <p className="mt-3">Outward Time: {row.outward_time || '__________'}</p>
      <Signatures left="Prepared By" middle="Store Keeper" right="Receiver Seal & Sign" />
    </div>
  )
}

export function PrintReceipt({ company, row }: { company: SessionCompany; row: LedgerRow }) {
  return (
    <div className="voucher">
      <Header
        company={company}
        right={<><p className="text-sm font-bold">Bank Receipt No: {row.voucher_no}</p><p>Date: {dateDMY(row.voucher_date)}</p></>}
      />
      <div className="voucher-title">BANK RECEIPT</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="voucher-box p-2">
          <p><strong>Received From:</strong> {row.customer_name}</p>
          <p><strong>Linked Invoice:</strong> {row.linked_gdn_no}</p>
          {(row.bank_account_no || row.bank_branch_name) && <p><strong>Bank Account / Branch:</strong> {row.bank_account_no || '—'} · {row.bank_branch_name || '—'}</p>}
        </div>
        <div className="voucher-box p-2">
          <p><strong>Bank Reference:</strong> {row.bank_reference}</p>
          <p><strong>Amount:</strong> PKR {money(row.bank_receipt_amount)}</p>
        </div>
      </div>
      <p className="mt-3"><strong>Amount In Words:</strong> PKR {amountInWords(row.bank_receipt_amount)} Only</p>
      <Signatures left="Received By" right="Accounts Sign & Stamp" />
    </div>
  )
}
