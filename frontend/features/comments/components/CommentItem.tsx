"use client"

import { format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react"
import { Blobatar } from "@/components/ui/blobatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useCommentAttachmentDownload } from "../hooks/useCommentAttachmentDownload"
import type { Comment, CommentTarget } from "../types"
import { CommentAttachmentsView } from "./CommentAttachmentsView"
import { CommentComposerForm } from "./CommentComposerForm"
import { MentionTextView } from "./MentionTextView"

interface CommentItemProps {
    comment: Comment
    target: CommentTarget
    editing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSaveEdit: (text: string) => Promise<unknown>
    onDelete: () => void
    onReply?: () => void
    compact?: boolean
}

export function CommentItem({
    comment,
    target,
    editing,
    onEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete,
    onReply,
    compact,
}: CommentItemProps) {
    const author = comment.author?.name ?? "Sistema"
    const date = new Date(comment.created_at)
    const hasMenu = comment.can_edit || comment.can_delete
    const { download, downloadingId } = useCommentAttachmentDownload()

    return (
        <article className="group flex gap-2" aria-label={`Comentario de ${author}`}>
            <Blobatar name={author} className={cn("shrink-0", compact ? "size-5" : "size-6")} />
            <div className="min-w-0 flex-1">
                <header className="flex items-baseline gap-1.5">
                    <span className="min-w-0 truncate text-2xs font-semibold text-foreground">
                        {comment.is_deleted ? "—" : author}
                    </span>
                    <time
                        dateTime={comment.created_at}
                        title={format(date, "d MMM yyyy, HH:mm", { locale: es })}
                        className="shrink-0 text-3xs text-muted-foreground/60"
                    >
                        {formatDistanceToNow(date, { addSuffix: true, locale: es })}
                    </time>
                    {comment.edited_at && !comment.is_deleted && (
                        <span className="shrink-0 text-3xs text-muted-foreground/60">(editado)</span>
                    )}
                    {hasMenu && !editing && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Acciones del comentario"
                                    className="ml-auto size-5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                                >
                                    <MoreHorizontal className="size-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {comment.can_edit && (
                                    <DropdownMenuItem onSelect={onEdit}>
                                        <Pencil className="size-3.5" /> Editar
                                    </DropdownMenuItem>
                                )}
                                {comment.can_delete && (
                                    <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                                        <Trash2 className="size-3.5" /> Eliminar
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </header>

                {comment.is_deleted ? (
                    <p className="text-xs italic text-muted-foreground">Comentario eliminado</p>
                ) : editing ? (
                    <CommentComposerForm
                        target={target}
                        initialText={comment.text}
                        initialMentions={comment.mentions}
                        onSubmit={onSaveEdit}
                        onCancel={onCancelEdit}
                        allowAttachments={false}
                        submitLabel="Guardar"
                        autoFocus
                        className="mt-1"
                    />
                ) : comment.text ? (
                    <MentionTextView text={comment.text} mentions={comment.mentions} />
                ) : null}

                {!comment.is_deleted && comment.attachments.length > 0 && (
                    <CommentAttachmentsView
                        className="mt-1"
                        attachments={comment.attachments.map(a => ({ key: a.id, name: a.name, size: a.size }))}
                        downloadingKey={downloadingId}
                        onDownload={index => void download(comment.id, comment.attachments[index])}
                    />
                )}

                {onReply && !editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onReply}
                        className="-ml-1 mt-0.5 h-auto gap-1 px-1 py-0.5 text-2xs text-muted-foreground/70 hover:bg-transparent hover:text-foreground"
                    >
                        <Reply className="size-3" /> Responder
                    </Button>
                )}
            </div>
        </article>
    )
}
