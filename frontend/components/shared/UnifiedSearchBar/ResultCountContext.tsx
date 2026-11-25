'use client'

import * as React from 'react'

const ResultCountContext = React.createContext<number | null>(null)

/**
 * Result count of the collection that owns the search bar (ADR-0158, collection-toolbar §5.2).
 * `Collection.Toolbar` provides it so `UnifiedSearchBar` shows "N resultados" without every page
 * passing the total. `null` while the total is unknown (loading).
 */
export function ResultCountProvider({ count, children }: { count: number | null; children: React.ReactNode }) {
  return <ResultCountContext.Provider value={count}>{children}</ResultCountContext.Provider>
}

/** Total provided by the enclosing collection toolbar, or `null` outside one / while loading. */
export function useResultCount(): number | null {
  return React.useContext(ResultCountContext)
}

const COUNT_FORMAT = new Intl.NumberFormat('es-CL')

export function formatResultCount(count: number): string {
  return `${COUNT_FORMAT.format(count)} ${count === 1 ? 'resultado' : 'resultados'}`
}
