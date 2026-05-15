"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { showApiError } from '@/lib/errors'

export interface WorkOrderComment {
    id: number
    user: number | null
    user_name: string
    text: string
    created_at: string
    source_label: 'OT' | 'NV' | string
}

const COMMENTS_KEY = 'work-order-comments'

export function useWorkOrderComments(orderId: number) {
    const queryClient = useQueryClient()

    const { data: comments = [], isLoading } = useQuery<WorkOrderComment[]>({
        queryKey: [COMMENTS_KEY, orderId],
        queryFn: async () => {
            const res = await api.get(`/production/orders/${orderId}/comments/`)
            return res.data
        },
        enabled: !!orderId,
    })

    const addMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await api.post(`/production/orders/${orderId}/comments/`, { text })
            return res.data as WorkOrderComment
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
