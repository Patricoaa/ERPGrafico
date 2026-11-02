"use client"

import { useCallback, useState } from "react"
import { showApiError } from "@/lib/errors"
import { commentsApi } from "../api/commentsApi"
import type { CommentAttachment } from "../types"

/** Descarga un adjunto de comentario; expone el id en curso para el estado de carga. */
export function useCommentAttachmentDownload() {
    const [downloadingId, setDownloadingId] = useState<number | null>(null)

    const download = useCallback(async (commentId: number, attachment: CommentAttachment) => {
        setDownloadingId(attachment.id)
        try {
            await commentsApi.downloadAttachment(commentId, attachment)
        } catch (error) {
            showApiError(error, "No se pudo descargar el archivo")
        } finally {
            setDownloadingId(null)
        }
    }, [])

    return { download, downloadingId }
}
