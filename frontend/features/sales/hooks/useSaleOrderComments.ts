"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { showApiError } from '@/lib/errors'

export interface SaleOrderComment {
    id: number
    user: number | null
    user_name: string
    text: string
    created_at: string
    source_label: string
}

const COMMENTS_KEY = 'sale-order-comments'

export function useSaleOrderComments(orderId: number | string) {
    const queryClient = useQueryClient()

    const { data: comments = [], isLoading } = useQuery<SaleOrderComment[]>({
        queryKey: [COMMENTS_KEY, orderId],
        queryFn: async () => {
            const res = await api.get(`/sales/orders/${orderId}/comments/`)
            return res.data
        },
        enabled: !!orderId,
    })

    const addMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await api.post(`/sales/orders/${orderId}/comments/`, { text })
            return res.data as SaleOrderComment
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [COMMENTS_KEY, orderId] })
        },
        onError: (err) => showApiError(err, 'Error al agregar comentario'),
    })

    return {
        comments,
        isLoading,
        addComment: addMutation.mutateAsync,
        isAdding: addMutation.isPending,
    }
}
