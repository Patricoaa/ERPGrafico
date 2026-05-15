"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWorkOrderComments } from "../../hooks/useWorkOrderComments"
import type { WorkOrderComment } from "../../hooks/useWorkOrderComments"

interface Props {
    orderId: number
}

function CommentBubble({ comment }: { comment: WorkOrderComment }) {
    const date = new Date(comment.created_at).toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-foreground">{comment.user_name}</span>
                {comment.source_label !== 'OT' && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{comment.source_label}</Badge>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{date}</span>
            </div>
            <div className="bg-muted/50 rounded-md px-3 py-2 text-xs leading-relaxed border border-border/40">
                {comment.text}
            </div>
        </div>
    )
}

export function OrderCommentPanel({ orderId }: Props) {
    const { comments, isLoading, addComment, isAdding } = useWorkOrderComments(orderId)
    const [text, setText] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [comments.length])

    const handleSubmit = async () => {
        const trimmed = text.trim()
        if (!trimmed) return
        await addComment(trimmed)
        setText('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="flex flex-col h-full border-t border-border/40 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comentarios</span>
                {comments.length > 0 && (
                    <Badge variant="secondary" className="h-4 text-[9px] px-1.5">{comments.length}</Badge>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-[80px] max-h-[240px] pr-1">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                        <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-4">Sin comentarios aún.</p>
                ) : (
                    comments.map(c => <CommentBubble key={c.id} comment={c} />)
                )}
                <div ref={bottomRef} />
            </div>

            <div className="mt-3 flex gap-2 items-end">
                <Textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
                    className="flex-1 resize-none text-xs min-h-[60px] max-h-[120px]"
                    rows={2}
                />
                <Button
                    size="sm"
                    variant="default"
                    disabled={!text.trim() || isAdding}
                    onClick={handleSubmit}
                    className={cn("h-9 shrink-0")}
                >
                    {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
            </div>
        </div>
    )
}
