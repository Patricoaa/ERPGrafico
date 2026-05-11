"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import api from "@/lib/api"
import { formatBytes } from "@/lib/utils"

interface AttachmentDetailClientProps {
    attachmentId: string
}

export function AttachmentDetailClient({ attachmentId }: AttachmentDetailClientProps) {
    const router = useRouter()
    const [attachment, setAttachment] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        const fetchAttachment = async () => {
            try {
                // Adjusting API route based on typical core implementation
                const response = await api.get(`/core/attachments/${attachmentId}/`)
                setAttachment(response.data)
            } catch (err: any) {
                setError(err.response?.status || 500)
            } finally {
                setLoading(false)
            }
        }
        fetchAttachment()
    }, [attachmentId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar archivo
        </div>
    )

    if (loading || !attachment) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const isImage = attachment.content_type?.startsWith('image/')
    const isPDF = attachment.content_type === 'application/pdf'
    const downloadUrl = attachment.file

    return (
        <EntityDetailPage
            entityType="attachment"
            title="Detalle de Archivo"
            displayId={attachment.original_filename}
            icon="paperclip"
            breadcrumb={[
                { label: "Archivos", href: "/files" },
                { label: attachment.original_filename, href: `/files/${attachmentId}` },
            ]}
            instanceId={parseInt(attachmentId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.back()}>Volver</CancelButton>
                            {downloadUrl && (
                                <ActionSlideButton onClick={() => window.open(downloadUrl, '_blank')}>
                                    Descargar
                                </ActionSlideButton>
                            )}
                        </>
                    }
                />
            }
        >
            <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6 bg-muted/5 p-6 rounded-xl border border-primary/10">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Nombre Original</p>
                        <p className="font-semibold truncate">{attachment.original_filename}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Tamaño</p>
                        <p className="font-semibold">{formatBytes(attachment.file_size)}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Tipo de Archivo</p>
                        <p className="font-semibold truncate">{attachment.content_type || 'Desconocido'}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Fecha de Subida</p>
                        <p className="font-semibold">{new Date(attachment.created_at).toLocaleString()}</p>
                    </div>
                </div>

                <div className="mt-8 border rounded-xl overflow-hidden bg-muted/10 min-h-[400px] flex items-center justify-center">
                    {isImage ? (
                        <img 
                            src={downloadUrl} 
                            alt={attachment.original_filename} 
                            className="max-w-full max-h-[600px] object-contain"
                        />
                    ) : isPDF ? (
                        <iframe 
                            src={downloadUrl} 
                            className="w-full h-[600px] border-0"
                            title={attachment.original_filename}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 text-muted-foreground">
                            <span className="text-4xl">📎</span>
                            <p>Vista previa no disponible para este tipo de archivo.</p>
                            <a href={downloadUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                                Descargar para ver
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </EntityDetailPage>
    )
}
