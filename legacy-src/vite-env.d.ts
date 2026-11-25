/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_LOCKED_COMPANY_CODE?: string
  readonly VITE_LOCKED_COMPANY_NAME?: string
  readonly VITE_LOCKED_EXPIRY_DATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
