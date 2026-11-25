import * as XLSX from 'xlsx'
import { fileStamp } from './format'
import type { Row } from './types'

export const exportRows = (rows: Row[], fileName: string, sheetName = 'Data'): void => {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'No records' }])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  XLSX.writeFile(workbook, `${fileName}_${fileStamp()}.xlsx`)
}

export const exportSheets = (sheets: Array<{ name: string; rows: Row[] }>, fileName: string): void => {
  const workbook = XLSX.utils.book_new()
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Message: 'No records' }])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  })
  XLSX.writeFile(workbook, `${fileName}_${fileStamp()}.xlsx`)
}

export const readRows = (file: File): Promise<Row[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read the selected file'))
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' }))
      } catch {
        reject(new Error('The selected file is not a valid Excel workbook'))
      }
    }
    reader.readAsArrayBuffer(file)
  })
