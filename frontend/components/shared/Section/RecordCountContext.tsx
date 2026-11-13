"use client"

import * as React from "react"

interface RecordCountValue {
    count: number | null
    setCount: (count: number | null) => void
}

const RecordCountContext = React.createContext<RecordCountValue | null>(null)

/**
 * Ámbito de conteo (ADR-0137): una `Collection` dentro del ámbito publica su total y los
 * `Section.Header` del mismo ámbito lo muestran cuando no reciben `count`. `Section` ya es un ámbito;
 * `Section.Scope` sirve cuando la cabecera y la colección son hermanas. Un ámbito, una colección.
 */
export function RecordCountScope({ children }: { children: React.ReactNode }) {
    const [count, setCount] = React.useState<number | null>(null)
    const value = React.useMemo(() => ({ count, setCount }), [count])
    return <RecordCountContext.Provider value={value}>{children}</RecordCountContext.Provider>
}

/** Total publicado por la colección del ámbito, o `null`. */
export function useRecordCount(): number | null {
    return React.useContext(RecordCountContext)?.count ?? null
}

/** La colección publica su total al ámbito (no hace nada fuera de uno). `null` = aún no disponible. */
export function useRegisterRecordCount(count: number | null): void {
    const setCount = React.useContext(RecordCountContext)?.setCount
    React.useEffect(() => {
        if (!setCount) return
        setCount(count)
        return () => setCount(null)
    }, [setCount, count])
}

export function formatRecordCount(count: number): string {
    return `${count} ${count === 1 ? "registro" : "registros"}`
}
