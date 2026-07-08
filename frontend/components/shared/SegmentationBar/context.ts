'use client'

import { createContext, useContext } from 'react'
import type { Table } from '@tanstack/react-table'

const SegmentationTableContext = createContext<Table<unknown> | null>(null)

export function useSegmentationTable<TData>(): Table<TData> | null {
  return useContext(SegmentationTableContext) as Table<TData> | null
}

export { SegmentationTableContext }
