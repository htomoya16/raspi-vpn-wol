import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { formatApiError } from '../../api/http'
import { listPcs } from '../../api/pcs'
import type { Pc, PcFilterState, PcStatus } from '../../types/models'

interface UsePcCollectionInput {
  appliedPcFilters: PcFilterState
}

interface UsePcCollectionResult {
  pcs: Pc[]
  pcLoading: boolean
  pcError: string
  lastSyncedAt: string
  onlineCount: number
  loadPcs: () => Promise<void>
  setPcError: (message: string) => void
  setPcs: Dispatch<SetStateAction<Pc[]>>
  markSyncedNow: () => void
  applyPcStatusEvent: (pcId: string, status: PcStatus, updatedAt: string, lastSeenAt: string | null) => void
  setPcStatusLocal: (pcId: string, status: PcStatus) => void
}

export function usePcCollection({ appliedPcFilters }: UsePcCollectionInput): UsePcCollectionResult {
  const [pcs, setPcs] = useState<Pc[]>([])
  const [pcLoading, setPcLoading] = useState(false)
  const [pcError, setPcError] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const loadPcsRequestSeqRef = useRef(0)

  const markSyncedNow = useCallback(() => {
    setLastSyncedAt(new Date().toISOString())
  }, [])

  const onlineCount = useMemo(() => pcs.filter((pc) => pc.status === 'online').length, [pcs])

  const loadPcs = useCallback(async () => {
    const requestSeq = loadPcsRequestSeqRef.current + 1
    loadPcsRequestSeqRef.current = requestSeq
    setPcLoading(true)
    setPcError('')

    try {
      const data = await listPcs({
        q: appliedPcFilters.q,
        status: appliedPcFilters.status,
        limit: 200,
      })
      if (requestSeq !== loadPcsRequestSeqRef.current) {
        return
      }
      setPcs(data?.items || [])
      setLastSyncedAt(new Date().toISOString())
    } catch (error) {
      if (requestSeq !== loadPcsRequestSeqRef.current) {
        return
      }
      setPcError(formatApiError(error))
    } finally {
      if (requestSeq === loadPcsRequestSeqRef.current) {
        setPcLoading(false)
      }
    }
  }, [appliedPcFilters.q, appliedPcFilters.status])

  const applyPcStatusEvent = useCallback(
    (pcId: string, status: PcStatus, updatedAt: string, lastSeenAt: string | null) => {
      setPcs((prev) =>
        prev.map((pc) =>
          pc.id === pcId
            ? {
                ...pc,
                status,
                updated_at: updatedAt,
                last_seen_at: lastSeenAt,
              }
            : pc,
        ),
      )
      setLastSyncedAt(new Date().toISOString())
    },
    [],
  )

  const setPcStatusLocal = useCallback((pcId: string, status: PcStatus) => {
    const updatedAt = new Date().toISOString()
    setPcs((prev) =>
      prev.map((pc) =>
        pc.id === pcId
          ? {
              ...pc,
              status,
              updated_at: updatedAt,
            }
          : pc,
      ),
    )
    setLastSyncedAt(updatedAt)
  }, [])

  return {
    pcs,
    pcLoading,
    pcError,
    lastSyncedAt,
    onlineCount,
    loadPcs,
    setPcError,
    setPcs,
    markSyncedNow,
    applyPcStatusEvent,
    setPcStatusLocal,
  }
}
