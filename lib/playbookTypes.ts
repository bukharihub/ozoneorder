export interface PlaybookTable {
  head: string[]
  rows: string[][]
}

export interface PlaybookSection {
  id: string
  titleEn: string
  titleUr: string
  paragraphsEn: string[]
  paragraphsUr: string[]
  bulletsEn?: string[]
  bulletsUr?: string[]
  tableEn?: PlaybookTable
  tableUr?: PlaybookTable
}

export interface FounderPlaybookData {
  warningEn: string
  warningUr: string
  sections: PlaybookSection[]
}
