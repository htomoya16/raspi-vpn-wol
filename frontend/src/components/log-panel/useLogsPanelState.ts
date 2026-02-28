import { useCallback, useReducer } from 'react'

import { PERIODIC_STATUS_GROUP_KEY } from './logGrouping'

interface LogsPanelState {
  confirmOpen: boolean
  focusOpen: boolean
  clearLoading: boolean
  expandedDetailIds: Set<number>
  collapsedGroupKeys: Set<string>
}

type LogsPanelAction =
  | { type: 'OPEN_CONFIRM' }
  | { type: 'CLOSE_CONFIRM' }
  | { type: 'OPEN_FOCUS' }
  | { type: 'CLOSE_FOCUS' }
  | { type: 'SET_CLEAR_LOADING'; payload: boolean }
  | { type: 'TOGGLE_DETAIL'; payload: number }
  | { type: 'TOGGLE_GROUP'; payload: string }
  | { type: 'SYNC_GROUP_KEYS'; payload: Set<string> }

const initialState: LogsPanelState = {
  confirmOpen: false,
  focusOpen: false,
  clearLoading: false,
  expandedDetailIds: new Set<number>(),
  collapsedGroupKeys: new Set<string>([PERIODIC_STATUS_GROUP_KEY]),
}

function areSetsEqual<T>(left: Set<T>, right: Set<T>): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }
  return true
}

function reducer(state: LogsPanelState, action: LogsPanelAction): LogsPanelState {
  switch (action.type) {
    case 'OPEN_CONFIRM':
      return { ...state, confirmOpen: true }
    case 'CLOSE_CONFIRM':
      return { ...state, confirmOpen: false }
    case 'OPEN_FOCUS':
      return { ...state, focusOpen: true }
    case 'CLOSE_FOCUS':
      return { ...state, focusOpen: false }
    case 'SET_CLEAR_LOADING':
      return { ...state, clearLoading: action.payload }
    case 'TOGGLE_DETAIL': {
      const expandedDetailIds = new Set(state.expandedDetailIds)
      if (expandedDetailIds.has(action.payload)) {
        expandedDetailIds.delete(action.payload)
      } else {
        expandedDetailIds.add(action.payload)
      }
      return { ...state, expandedDetailIds }
    }
    case 'TOGGLE_GROUP': {
      const collapsedGroupKeys = new Set(state.collapsedGroupKeys)
      if (collapsedGroupKeys.has(action.payload)) {
        collapsedGroupKeys.delete(action.payload)
      } else {
        collapsedGroupKeys.add(action.payload)
      }
      return { ...state, collapsedGroupKeys }
    }
    case 'SYNC_GROUP_KEYS': {
      const next = new Set<string>()
      for (const key of state.collapsedGroupKeys) {
        if (action.payload.has(key)) {
          next.add(key)
        }
      }
      if (action.payload.has(PERIODIC_STATUS_GROUP_KEY)) {
        next.add(PERIODIC_STATUS_GROUP_KEY)
      }
      if (areSetsEqual(next, state.collapsedGroupKeys)) {
        return state
      }
      return { ...state, collapsedGroupKeys: next }
    }
    default:
      return state
  }
}

export function useLogsPanelState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const openConfirm = useCallback(() => dispatch({ type: 'OPEN_CONFIRM' }), [])
  const closeConfirm = useCallback(() => dispatch({ type: 'CLOSE_CONFIRM' }), [])
  const openFocus = useCallback(() => dispatch({ type: 'OPEN_FOCUS' }), [])
  const closeFocus = useCallback(() => dispatch({ type: 'CLOSE_FOCUS' }), [])
  const setClearLoading = useCallback(
    (value: boolean) => dispatch({ type: 'SET_CLEAR_LOADING', payload: value }),
    [],
  )
  const toggleDetail = useCallback(
    (id: number) => dispatch({ type: 'TOGGLE_DETAIL', payload: id }),
    [],
  )
  const toggleGroup = useCallback(
    (key: string) => dispatch({ type: 'TOGGLE_GROUP', payload: key }),
    [],
  )
  const syncGroupKeys = useCallback(
    (keys: Set<string>) => dispatch({ type: 'SYNC_GROUP_KEYS', payload: keys }),
    [],
  )

  return {
    ...state,
    openConfirm,
    closeConfirm,
    openFocus,
    closeFocus,
    setClearLoading,
    toggleDetail,
    toggleGroup,
    syncGroupKeys,
  }
}
