import { useCallback, useState } from 'react'

import type { PcFilterState } from '../../types/models'
import { DEFAULT_PC_FILTERS } from './constants'

interface UsePcFiltersResult {
  pcFilters: PcFilterState
  appliedPcFilters: PcFilterState
  handleFilterChange: (key: keyof PcFilterState, value: string) => void
  handleApplyFilters: () => void
  handleClearFilters: () => void
}

export function usePcFilters(): UsePcFiltersResult {
  const [pcFilters, setPcFilters] = useState<PcFilterState>(DEFAULT_PC_FILTERS)
  const [appliedPcFilters, setAppliedPcFilters] = useState<PcFilterState>(DEFAULT_PC_FILTERS)

  const handleFilterChange = useCallback((key: keyof PcFilterState, value: string) => {
    setPcFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const handleApplyFilters = useCallback(() => {
    setAppliedPcFilters({ ...pcFilters })
  }, [pcFilters])

  const handleClearFilters = useCallback(() => {
    setPcFilters(DEFAULT_PC_FILTERS)
    setAppliedPcFilters(DEFAULT_PC_FILTERS)
  }, [])

  return {
    pcFilters,
    appliedPcFilters,
    handleFilterChange,
    handleApplyFilters,
    handleClearFilters,
  }
}
