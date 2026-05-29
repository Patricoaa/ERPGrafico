"use client"

import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { MOVEMENTS_KEYS } from './queryKeys'
import type { DateRange } from 'react-day-picker'
import { format } from 'date-fns'

export function useTerminalMovements(providerId: string, dateRange: DateRange | undefined, open: boolean) {
    return useQuery({
        queryKey: [
            ...MOVEMENTS_KEYS.lists(),
            'provider',
            providerId,
            dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
            dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
        ],
        queryFn: () => {
            const params: Record<string, string> = {
                terminal_provider: providerId,
                movement_type: 'INBOUND',
                terminal_batch__isnull: 'True',
            }
            if (dateRange?.from) {
                params.date_from = format(dateRange.from, 'yyyy-MM-dd')
            }
            if (dateRange?.to) {
                params.date_to = format(dateRange.to, 'yyyy-MM-dd')
            }
            return treasuryApi.getMovements(params)
        },
        enabled: open && !!providerId && !!dateRange?.from,
        staleTime: 30 * 1000,
    })
}
