export function toRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map((value) => `${value}${value}`).join('') : normalized
  const value = Number.parseInt(full, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const asHex = (value: number) => value.toString(16).padStart(2, '0')
  return `#${asHex(Math.max(0, Math.min(255, Math.round(r))))}${asHex(Math.max(0, Math.min(255, Math.round(g))))}${asHex(Math.max(0, Math.min(255, Math.round(b))))}`
}

export function mixHex(base: string, target: string, ratio: number): string {
  const a = toRgb(base)
  const b = toRgb(target)
  const mixed = {
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  }
  return rgbToHex(mixed)
}

export function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = toRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
