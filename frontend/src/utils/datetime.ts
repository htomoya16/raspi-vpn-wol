interface FormatOptions {
  fallback?: string
}

interface FormatDatePartsOptions {
  fallbackDate?: string
  fallbackTime?: string
}

interface DateParts {
  date: string
  time: string
}

type DateLike = string | number | Date | null | undefined

function parseNaiveUtc(raw: string): Date | null {
  const naive = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/)
  if (!naive) {
    return null
  }

  const utc = new Date(`${naive[1]}T${naive[2]}Z`)
  if (Number.isNaN(utc.getTime())) {
    return null
  }
  return utc
}

export function parseDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const raw = String(value).trim()
  if (!raw) {
    return null
  }

  const naiveUtc = parseNaiveUtc(raw)
  if (naiveUtc) {
    return naiveUtc
  }

  const direct = new Date(raw)
  if (Number.isNaN(direct.getTime())) {
    return null
  }
  return direct
}

function formatWith(value: DateLike, formatter: (date: Date) => string, fallback: string): string {
  const date = parseDate(value)
  if (!date) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value)
    }
    return fallback
  }

  try {
    return formatter(date)
  } catch {
    return String(value)
  }
}

export function formatLocalDateTime(value: DateLike, options: FormatOptions = {}): string {
  const { fallback = '-' } = options
  return formatWith(value, (date) => date.toLocaleString(), fallback)
}

export function formatLocalTime(value: DateLike, options: FormatOptions = {}): string {
  const { fallback = '-' } = options
  return formatWith(value, (date) => date.toLocaleTimeString(), fallback)
}

export function formatJstDateTime(value: DateLike, options: FormatOptions = {}): string {
  const { fallback = '-' } = options
  return formatWith(
    value,
    (date) =>
      date.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        hour12: false,
      }),
    fallback,
  )
}

export function formatJstDateParts(value: DateLike, options: FormatDatePartsOptions = {}): DateParts {
  const { fallbackDate = '-', fallbackTime = '' } = options
  const formatted = formatJstDateTime(value, { fallback: '' })
  const text = String(formatted).trim()
  if (!text) {
    return { date: fallbackDate, time: fallbackTime }
  }

  const match = text.match(/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/)
  if (!match) {
    return { date: text, time: fallbackTime }
  }

  return { date: match[1], time: match[2] }
}
