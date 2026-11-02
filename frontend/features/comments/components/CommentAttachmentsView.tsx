"use client"

import { Download, FileText, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatBytes } from "@/lib/utils"

export interface AttachmentChip {
    key: string | number
    name: string
    size: number
}

interface CommentAttachmentsViewProps {
    attachments: AttachmentChip[]
    /** Archivos ya subidos: descarga por índice. */
    onDownload?: (index: number) => void
    /** Archivos pendientes en el composer: quitar por índice. */
    onRemove?: (index: number) => void
    downloadingKey?: string | number | null
    className?: string
}

/**
 * Lista compacta de adjuntos para el rail de comentarios (ADR-0111). `AttachmentList`
 * (grid de 2 columnas con fechas) no cabe en un rail de 288px.
 */
export function CommentAttachmentsView({
    attachments,
    onDownload,
    onRemove,
    downloadingKey,
    className,
}: CommentAttachmentsViewProps) {
    return (
        <ul className={cn("flex flex-col gap-1", className)} aria-label="Archivos adjuntos">
            {attachments.map((file, index) => {
                const downloading = downloadingKey === file.key
                return (
                    <li
                        key={file.key}
                        className="flex min-w-0 items-center gap-1.5 rounded-sm border border-border/60 bg-muted/30 py-0.5 pl-1.5 pr-0.5"
                    >
                        <FileText aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-2xs text-foreground" title={file.name}>
                            {file.name}
                        </span>
                        <span className="shrink-0 text-3xs tabular-nums text-muted-foreground/70">
                            {formatBytes(file.size, 1)}
                        </span>
                        {onDownload && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={downloading}
                                onClick={() => onDownload(index)}
                                aria-label={`Descargar ${file.name}`}
                                className="size-5 text-muted-foreground hover:text-primary"
                            >
                                {downloading ? (
                                    // eslint-disable-next-line no-restricted-syntax -- icon-only download spinner; action buttons require text content
                                    <Loader2 className="size-3 animate-spin" />
                                ) : (
                                    <Download className="size-3" />
                                )}
                            </Button>
                        )}
                        {onRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemove(index)}
                                aria-label={`Quitar ${file.name}`}
                                className="size-5 text-muted-foreground hover:text-destructive"
                            >
                                <X className="size-3" />
                            </Button>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
