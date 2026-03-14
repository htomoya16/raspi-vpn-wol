import { useEffect, type RefObject } from 'react'

interface UseStickyGroupHeadersInput {
  mainSheetRef: RefObject<HTMLDivElement | null>
  focusSheetRef: RefObject<HTMLDivElement | null>
  syncToken: string
}

export function useStickyGroupHeaders({
  mainSheetRef,
  focusSheetRef,
  syncToken,
}: UseStickyGroupHeadersInput): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }
    if (window.matchMedia('(max-width: 760px)').matches) {
      return undefined
    }

    const sheets = [mainSheetRef.current, focusSheetRef.current].filter(
      (sheet): sheet is HTMLDivElement => Boolean(sheet),
    )
    if (sheets.length === 0) {
      return undefined
    }

    const syncStickyGroup = (sheet: HTMLDivElement): void => {
      const rows = Array.from(sheet.querySelectorAll<HTMLTableRowElement>('.logs-table__group-row'))
      rows.forEach((row) => row.classList.remove('logs-table__group-row--sticky'))
      if (rows.length === 0) {
        return
      }

      const sheetRect = sheet.getBoundingClientRect()
      const sheetStyle = window.getComputedStyle(sheet)
      const isWindowScrollContext =
        sheetStyle.overflowY === 'visible' || sheet.scrollHeight <= sheet.clientHeight + 1

      const thead = sheet.querySelector('thead')
      const theadHeight = thead ? thead.getBoundingClientRect().height : 0
      const stickyTop = isWindowScrollContext ? 0 : sheetRect.top + theadHeight

      let activeRow: HTMLTableRowElement | null = null
      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        if (rect.top <= stickyTop + 1) {
          activeRow = row
          continue
        }
        break
      }

      if (!activeRow) {
        if (isWindowScrollContext) {
          if (sheetRect.top <= stickyTop + 1) {
            activeRow = rows[0]
          }
        } else if (sheet.scrollTop > 0) {
          activeRow = rows[0]
        }
      }

      if (activeRow) {
        activeRow.classList.add('logs-table__group-row--sticky')
      }
    }

    let rafId = 0
    const syncAll = () => {
      if (rafId) {
        return
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        sheets.forEach((sheet) => syncStickyGroup(sheet))
      })
    }

    syncAll()
    sheets.forEach((sheet) => {
      sheet.addEventListener('scroll', syncAll, { passive: true })
    })
    window.addEventListener('scroll', syncAll, { passive: true })
    window.addEventListener('resize', syncAll)

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      sheets.forEach((sheet) => {
        sheet.removeEventListener('scroll', syncAll)
      })
      window.removeEventListener('scroll', syncAll)
      window.removeEventListener('resize', syncAll)
    }
  }, [focusSheetRef, mainSheetRef, syncToken])
}
