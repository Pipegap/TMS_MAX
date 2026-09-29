import { INDUSTRIES } from './dictionaries.js'

type IndustryId =
  (typeof INDUSTRIES)[number]['id']


export function industryFromOkved(
  code: string,
): IndustryId {
  const normalized = code
    .trim()
    .replace(',', '.')

 
  const section = Number(
    normalized.slice(0, 2),
  )


  if (
    section >= 1 &&
    section <= 3
  ) {
    return 'agro'
  }

  
  if (
    section >= 10 &&
    section <= 33
  ) {
    return 'production'
  }

  
  if (
    section >= 41 &&
    section <= 43
  ) {
    return 'construction'
  }

  if (
    section >= 45 &&
    section <= 47
  ) {
    return 'trade'
  }

  
  if (section === 56) {
    return 'food'
  }

 
  if (
    section === 55 ||
    section === 79
  ) {
    return 'tourism'
  }

 
  if (
    section === 58 ||
    section === 62 ||
    section === 63
  ) {
    return 'it'
  }

  
  return 'services'
}