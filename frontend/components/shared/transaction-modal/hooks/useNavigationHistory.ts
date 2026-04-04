import { useState, useEffect } from "react"
import type { TransactionType } from "@/types/transactions"

export interface NavigationEntry {
    type: TransactionType
    id: number | string
}

export function useNavigationHistory(initialType: TransactionType, initialId: number | string) {
    const [history, setHistory] = useState<NavigationEntry[]>([])
    const [current, setCurrent] = useState<NavigationEntry>({ type: initialType, id: initialId })

    // Reset when initial props change
    useEffect(() => {
        setCurrent({ type: initialType, id: initialId })
        setHistory([])
    }, [initialType, initialId])

    const navigateTo = (type: TransactionType, id: number | string) => {
        setHistory(prev => [...prev, current])
        setCurrent({ type, id })
    }

    const goBack = () => {
        if (history.length === 0) return
        const prev = history[history.length - 1]
        setHistory(h => h.slice(0, -1))
        setCurrent(prev)
    }

    return {
        currentType: current.type,
        currentId: current.id,
        canGoBack: history.length > 0,
        navigateTo,
        goBack,
    }
}
