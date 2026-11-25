'use client'

import React from 'react'
import { resolveLogoUrl } from '@/lib/logo'

export function CompanyLogo({
  url,
  companyCode,
  companyName,
  className = '',
}: {
  url?: string
  companyCode?: string
  companyName?: string
  className?: string
}) {
  const src = resolveLogoUrl(url, companyCode)
  if (!src) return null
  return (
    <img
      src={src}
      alt={`${companyName || 'Company'} logo`}
      className={`company-logo ${className}`}
      onError={(event) => { event.currentTarget.style.display = 'none' }}
    />
  )
}
