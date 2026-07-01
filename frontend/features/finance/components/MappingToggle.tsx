'use client'

import { History, RefreshCw } from 'lucide-react'
import { Chip } from '@/components/shared'

interface MappingToggleProps {
    year: number
    isHistorical: boolean
    onToggle: () => void
}

export function MappingToggle({ year, isHistorical, onToggle }: MappingToggleProps) {
    return (
        <button type="button" onClick={onToggle} className="cursor-pointer">
            {isHistorical ? (
                <Chip intent="info" size="sm" icon={History}>
                    Mapeo congelado al cierre {year}
                </Chip>
            ) : (
                <Chip intent="neutral" size="sm" icon={RefreshCw}>
                    Mapeo vivo
                </Chip>
            )}
        </button>
    )
}
