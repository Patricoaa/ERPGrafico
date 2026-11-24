"use client"

import { useEffect, useState } from "react"

/** Fecha y hora actuales, refrescadas cada `intervalMs` (reloj en vivo). */
export function useNow(intervalMs = 1000): Date {
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs)
        return () => clearInterval(id)
    }, [intervalMs])

    return now
}
