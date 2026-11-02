import { beforeEach, describe, expect, it, vi } from 'vitest'

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }))

vi.mock('@/lib/api', () => ({ default: { post: postMock } }))

import { purchasingApi } from '../purchasingApi'

describe('purchasingApi.partialReceive', () => {
    beforeEach(() => postMock.mockReset())

    it('sends the idempotency key required by the partial receipt endpoint', async () => {
        const payload = {
            warehouse_id: 3,
            receipt_date: '2026-11-02',
            delivery_reference: 'ENT-42',
            notes: '',
            line_data: [{ line_id: 7, quantity: 1, unit_cost: 1250 }],
        }

        await purchasingApi.partialReceive(42, payload, 'attempt-uuid')

        expect(postMock).toHaveBeenCalledWith(
            '/purchasing/orders/42/partial_receive/',
            payload,
            { headers: { 'Idempotency-Key': 'attempt-uuid' } },
        )
    })
})