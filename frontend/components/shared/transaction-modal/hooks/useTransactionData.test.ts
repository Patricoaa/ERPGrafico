import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTransactionData, ENDPOINT_MAP } from './useTransactionData'
import api from '@/lib/api'

// Mock the api module
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
    },
}))

describe('useTransactionData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('maps endpoints correctly', () => {
        expect(ENDPOINT_MAP['invoice'](123)).toBe('/billing/invoices/123/')
        expect(ENDPOINT_MAP['payment'](456)).toBe('/treasury/payments/456/')
    })

    it('does not fetch if not enabled', () => {
        renderHook(() =>
            useTransactionData({ type: 'invoice', id: 123, enabled: false })
        )
        expect(api.get).not.toHaveBeenCalled()
    })

    it('fetches data when enabled', async () => {
        const mockData = { id: 123, number: 'INV-123' }
        vi.mocked(api.get).mockResolvedValueOnce({ data: mockData })

        const { result } = renderHook(() =>
            useTransactionData({ type: 'invoice', id: 123, enabled: true })
        )

        expect(result.current.loading).toBe(true)
        expect(api.get).toHaveBeenCalledWith('/billing/invoices/123/')

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.data).toEqual(mockData)
    })
})
