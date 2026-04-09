"use client"

import { useState } from "react"
import { MessageSquare, Send, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface Comment {
    user: string
    text: string
    timestamp: string
}

interface CommentSystemProps {
    comments: Comment[]
    onAddComment: (text: string) => void
    placeholder?: string
    emptyMessage?: string
    className?: string
    maxHeight?: string
}

export function CommentSystem({
    comments = [],
    onAddComment,
    placeholder = "Agregar comentario...",
    emptyMessage = "No hay comentarios aún",
    className,
    maxHeight = "400px"
}: CommentSystemProps) {
    const [newComment, setNewComment] = useState("")

    const handleSendComment = () => {
        if (!newComment.trim()) return
        onAddComment(newComment.trim())
        setNewComment("")
    }

    return (
        <div className={cn("space-y-4 flex flex-col", className)}>
            {/* Comment Feed */}
            <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight }}>
                {comments.length > 0 ? comments.map((comment, i) => (
                    <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary">
                                {comment.user.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 bg-background rounded-lg border p-2 space-y-1 shadow-sm">
                            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1 mb-1">
                                <span className="text-[10px] font-bold truncate">{comment.user}</span>
                                <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                                    {new Date(comment.timestamp).toLocaleTimeString('es-CL', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        day: '2-digit',
                                        month: '2-digit'
                                    })}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-8 space-y-2 border-2 border-dashed rounded-lg bg-muted/20">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                        <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
                    </div>
                )}
            </div>

            {/* Comment Input */}
            <div className="space-y-2 pt-2 border-t">
                <div className="relative">
                    <Textarea
                        placeholder={placeholder}
                        className="min-h-[80px] text-xs resize-none pr-10 bg-background focus-visible:ring-primary/30"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendComment()
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 bottom-2 h-7 w-7 hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={handleSendComment}
                        disabled={!newComment.trim()}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>

            </div>
        </div>
    )
}
