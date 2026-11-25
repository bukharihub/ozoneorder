import { supabase } from './supabase'

export const LOGO_BUCKET = 'company-logos'
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

export const validateLogoFile = (file: File) => {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Logo must be a PNG, JPG, SVG or WEBP image')
  if (file.size > MAX_LOGO_BYTES) throw new Error('Logo must be 2MB or smaller')
}

export const publicLogoUrl = (companyCode: string) =>
  supabase.storage.from(LOGO_BUCKET).getPublicUrl(`${companyCode.toLowerCase()}/logo`).data.publicUrl

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Unable to read the logo file'))
  reader.readAsDataURL(file)
})

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Unable to decode the logo image'))
  image.src = src
})

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => {
  canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.82)
})

const compressLogo = async (file: File): Promise<{ blob: Blob; dataUrl: string; contentType: string }> => {
  if (file.type === 'image/svg+xml') {
    const dataUrl = await readAsDataUrl(file)
    return { blob: file, dataUrl, contentType: file.type }
  }
  const source = await readAsDataUrl(file)
  const image = await loadImage(source)
  const maxWidth = 640
  const maxHeight = 320
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await canvasToBlob(canvas)
  const contentType = blob?.type || 'image/png'
  return {
    blob: blob || new Blob([], { type: contentType }),
    dataUrl: blob ? await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.readAsDataURL(blob)
    }) : canvas.toDataURL('image/png'),
    contentType,
  }
}

export const uploadCompanyLogo = async (file: File, companyCode: string): Promise<string> => {
  validateLogoFile(file)
  const compressed = await compressLogo(file)
  const path = `${companyCode.toLowerCase()}/logo`
  try {
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(LOGO_BUCKET)
    if (bucketError || !bucket) {
      const { error: createError } = await supabase.storage.createBucket(LOGO_BUCKET, { public: true })
      if (createError && !createError.message.toLowerCase().includes('already exists')) throw createError
    }
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, compressed.blob, { upsert: true, contentType: compressed.contentType })
    if (uploadError) throw uploadError
    return `${supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  } catch {
    return compressed.dataUrl
  }
}

export const resolveLogoUrl = (storedUrl?: string, companyCode?: string) => {
  if (storedUrl) return storedUrl
  return companyCode ? publicLogoUrl(companyCode) : ''
}
