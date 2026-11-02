"use client"

import { useState } from "react"
import { MessageSquare } from "lucide-react"
import { ActionConfirmModal, CollapsibleSection, EmptyState, SkeletonShell } from "@/components/shared"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCommentMutations } from "../hooks/useCommentMutations"
import { useEntityComments } from "../hooks/useEntityComments"
import type { CommentTarget } from "../types"
import { CommentComposerForm } from "./CommentComposerForm"
import { CommentItem } from "./CommentItem"

interface CommentsPanelProps {
    target: CommentTarget
    title?: string
    defaultOpen?: boolean
    className?: string
}

/** Hilos de comentarios con @menciones sobre cualquier entidad (ADR-0111). */
export function CommentsPanel({ target, title = "Comentarios", defaultOpen = true, className }: CommentsPanelProps) {
    const { threads, count, loading, error } = useEntityComments(target)
    const { createComment, updateComment, deleteComment, isDeleting } = useCommentMutations(target)
    const [open, setOpen] = useState(defaultOpen)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [replyingTo, setReplyingTo] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)

    const badge = count > 0 ? (
        <span className="text-3xs font-medium tabular-nums text-muted-foreground/60">{count}</span>
    ) : undefined

    const itemProps = (id: number) => ({
        target,
        editing: editingId === id,
        onEdit: () => setEditingId(id),
        onCancelEdit: () => setEditingId(null),
        onSaveEdit: async (text: string) => {
            await updateComment({ id, text })
            setEditingId(null)
        },
        onDelete: () => setDeletingId(id),
    })

    return (
        <CollapsibleSection
            title={title}
            icon={MessageSquare}
            badge={badge}
            open={open}
            onOpenChange={setOpen}
            className={className}
        >
            <SkeletonShell isLoading={loading} ariaLabel="Cargando comentarios" className="flex min-h-0 flex-1 flex-col">
                <ScrollArea className="min-h-0 flex-1 px-4 py-3">
                    {!loading && error ? (
                        <div role="alert" className="rounded-md border border-dashed border-destructive/25 bg-destructive/5 px-3 py-6 text-center">
                            <p className="text-xs font-medium text-destructive">No se pudieron cargar los comentarios</p>
                            <p className="mt-1 break-words text-3xs text-muted-foreground/70">{error}</p>
                        </div>
                    ) : !loading && threads.length === 0 ? (
                        <EmptyState
                            variant="compact"
                            context="generic"
                            icon={MessageSquare}
                            title="Sin comentarios"
                            description="Inicia la conversación y menciona a tu equipo con @."
                        />
                    ) : (
                        <ol className="space-y-4">
                            {threads.map(thread => (
                                <li key={thread.id} className="space-y-2">
                                    <CommentItem
                                        comment={thread}
                                        {...itemProps(thread.id)}
                                        onReply={() => setReplyingTo(thread.id)}
                                    />
                                    {(thread.replies.length > 0 || replyingTo === thread.id) && (
                                        <ol className="ml-3 space-y-2 border-l border-border/60 pl-3">
                                            {thread.replies.map(reply => (
                                                <li key={reply.id}>
                                                    <CommentItem comment={reply} {...itemProps(reply.id)} compact />
                                                </li>
                                            ))}
                                            {replyingTo === thread.id && (
                                                <li>
                                                    <CommentComposerForm
                                                        target={target}
                                                        placeholder="Responder…"
                                                        submitLabel="Responder"
                                                        autoFocus
                                                        onCancel={() => setReplyingTo(null)}
                                                        onSubmit={async (text, files) => {
                                                            await createComment({ text, files, parentId: thread.id })
                                                            setReplyingTo(null)
                                                        }}
                                                    />
                                                </li>
                                            )}
                                        </ol>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </ScrollArea>
            </SkeletonShell>

            <div className="shrink-0 border-t border-border/60 px-4 py-3">
                <CommentComposerForm target={target} onSubmit={(text, files) => createComment({ text, files })} />
            </div>

            <ActionConfirmModal
                open={deletingId !== null}
                onOpenChange={next => !next && setDeletingId(null)}
                onConfirm={async () => {
                    if (deletingId === null) return
                    await deleteComment(deletingId)
                    setDeletingId(null)
                }}
                title="Eliminar comentario"
                description="El comentario dejará de mostrarse. Si tiene respuestas, el hilo se conserva."
                confirmText="Eliminar"
                variant="destructive"
                disabled={isDeleting}
            />
        </CollapsibleSection>
    )
}
