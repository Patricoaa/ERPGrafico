import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useNavigationHistory } from './useNavigationHistory'

describe('useNavigationHistory', () => {
    it('initializes with the given initial state', () => {
        const { result } = renderHook(() => useNavigationHistory('invoice', 123))

        expect(result.current.currentType).toBe('invoice')
        expect(result.current.currentId).toBe(123)
        expect(result.current.canGoBack).toBe(false)
    })

    it('navigates to a new transaction and can go back', () => {
        const { result } = renderHook(() => useNavigationHistory('invoice', 123))

        act(() => {
            result.current.navigateTo('payment', 456)
        })

        expect(result.current.currentType).toBe('payment')
        expect(result.current.currentId).toBe(456)
        expect(result.current.canGoBack).toBe(true)

        act(() => {
            result.current.goBack()
        })

        expect(result.current.currentType).toBe('invoice')
        expect(result.current.currentId).toBe(123)
        expect(result.current.canGoBack).toBe(false)
    })

    it('resets history when initial props change', () => {
        const { result, rerender } = renderHook(
            ({ type, id }) => useNavigationHistory(type as any, id),
            { initialProps: { type: 'invoice', id: 123 } }
        )

        act(() => {
            result.current.navigateTo('payment', 456)
        })
        expect(result.current.canGoBack).toBe(true)

        // Rerender with different props
        rerender({ type: 'sale_order', id: 789 })

        expect(result.current.currentType).toBe('sale_order')
        expect(result.current.currentId).toBe(789)
        expect(result.current.canGoBack).toBe(false)
    })
})
