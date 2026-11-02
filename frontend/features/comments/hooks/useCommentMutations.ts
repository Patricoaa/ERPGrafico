"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useRealtime } from "@/features/realtime"
import { showApiError } from "@/lib/errors"
import { commentsApi } from "../api/commentsApi"
import type { CommentTarget, CreateCommentPayload } from "../types"
import { COMMENT_KEYS } from "./queryKeys"

export function useCommentMutations(target: CommentTarget) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: COMMENT_KEYS.target(target) })

    const create = useMutation({
        mutationFn: (payload: CreateCommentPayload) => commentsApi.create(target, payload),
        onSuccess: () => {
            markLocalMutation()
            void invalidate()
        },
        onError: (error: Error) => showApiError(error, "No se pudo publicar el comentario"),
    })

    const update = useMutation({
        mutationFn: ({ id, text }: { id: number; text: string }) => commentsApi.update(id, text),
        onSuccess: () => {
            markLocalMutation()
            void invalidate()
        },
        onError: (error: Error) => showApiError(error, "No se pudo editar el comentario"),
    })

    const remove = useMutation({
        mutationFn: (id: number) => commentsApi.remove(id),
        onSuccess: () => {
            markLocalMutation()
            void invalidate()
            toast.success("Comentario eliminado")
        },
        onError: (error: Error) => showApiError(error, "No se pudo eliminar el comentario"),
    })

    return {
        createComment: create.mutateAsync,
        updateComment: update.mutateAsync,
        deleteComment: remove.mutateAsync,
        isCreating: create.isPending,
        isUpdating: update.isPending,
        isDeleting: remove.isPending,
    }
}
