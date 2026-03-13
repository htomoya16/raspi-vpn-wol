import { useCallback, useReducer } from 'react'

import { isPeriodicStatusGroupKey } from './logGrouping'

interface LogsPanelState {
  confirmOpen: boolean
  focusOpen: boolean
  clearLoading: boolean
  expandedDetailIds: Set<number>
  collapsedGroupKeys: Set<string>
  currentGroupKeys: Set<string>
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
  collapsedGroupKeys: new Set<string>(),
  currentGroupKeys: new Set<string>(),
}

function parsePeriodicGroupId(key: string): number | null {
  const [, suffix] = key.split(':').slice(-2)
  if (!suffix) {
    return null
  }
  const id = Number(suffix)
  return Number.isFinite(id) ? id : null
}

function comparePeriodicGroupKey(left: string, right: string): number {
  const leftId = parsePeriodicGroupId(left)
  const rightId = parsePeriodicGroupId(right)
  if (leftId !== null && rightId !== null && leftId !== rightId) {
    return rightId - leftId
  }
  return left.localeCompare(right)
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
      if (action.payload.size === 0) {
        if (state.collapsedGroupKeys.size === 0 && state.currentGroupKeys.size === 0) {
          return state
        }
        return { ...state, collapsedGroupKeys: new Set<string>(), currentGroupKeys: new Set<string>() }
      }

      const next = new Set<string>()
      for (const key of state.collapsedGroupKeys) {
        if (action.payload.has(key)) {
          next.add(key)
        }
      }

      const removedPeriodicKeys = Array.from(state.currentGroupKeys)
        .filter((key) => isPeriodicStatusGroupKey(key) && !action.payload.has(key))
        .sort(comparePeriodicGroupKey)
      const addedPeriodicKeys = Array.from(action.payload)
        .filter((key) => isPeriodicStatusGroupKey(key) && !state.currentGroupKeys.has(key))
        .sort(comparePeriodicGroupKey)

      const transferredAddedKeys = new Set<string>()
      const transferCount = Math.min(removedPeriodicKeys.length, addedPeriodicKeys.length)
      for (let index = 0; index < transferCount; index += 1) {
        const removedKey = removedPeriodicKeys[index]
        const addedKey = addedPeriodicKeys[index]
        transferredAddedKeys.add(addedKey)
        if (state.collapsedGroupKeys.has(removedKey)) {
          next.add(addedKey)
        }
      }

      for (const key of addedPeriodicKeys) {
        if (transferredAddedKeys.has(key)) {
          continue
        }
        next.add(key)
      }

      const currentGroupKeys = new Set(action.payload)
      if (areSetsEqual(next, state.collapsedGroupKeys) && areSetsEqual(currentGroupKeys, state.currentGroupKeys)) {
        return state
      }
      return { ...state, collapsedGroupKeys: next, currentGroupKeys }
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
