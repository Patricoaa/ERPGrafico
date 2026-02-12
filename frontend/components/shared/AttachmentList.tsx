"use client"

import React from "react"
import { Paperclip, FileText, Download, ExternalLink, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn, formatPlainDate } from "@/lib/utils"

interface Attachment {
    id: number
    file: string
    original_filename: string
    file_size_formatted: string
    uploaded_at: string
    user_name?: string
    mime_type?: string
}

interface AttachmentListProps {
    attachments: Attachment[]
    onDelete?: (id: number) => void
    isDeleting?: number | null
    className?: string
}

export function AttachmentList({
    attachments,
    onDelete,
    isDeleting,
    className
}: AttachmentListProps) {
    if (!attachments || attachments.length === 0) {
        return (
            <div className={cn("text-center py-6 border border-dashed rounded-xl bg-muted/5", className)}>
                <Paperclip className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground italic">No hay archivos adjuntos</p>
            </div>
        )
    }

    return (
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
            {attachments.map((file) => (
                <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary/50 transition-colors group"
                >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate pr-2" title={file.original_filename}>
                            {file.original_filename}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {file.file_size_formatted}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50 h-1 w-1 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {formatPlainDate(file.uploaded_at)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            asChild
                        >
                            <a href={file.file} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>

                        {onDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => onDelete(file.id)}
                                disabled={isDeleting === file.id}
                            >
                                {isDeleting === file.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
