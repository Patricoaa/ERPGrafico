"use client"

import React from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Chip, CancelButton, SubmitButton } from "@/components/shared"
import { AlertCircle, ExternalLink, Package } from "lucide-react"
import Link from "next/link"
import { Loader2, RefreshCcw } from "lucide-react"

export interface Restriction {
    type: string
    label: string
    description: string
    action_hint?: string
    count: number
    link: string
}

interface ArchivingRestrictionsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    productName: string
    restrictions: Restriction[]
    onRetry?: () => void
    isRetrying?: boolean
}

export function ArchivingRestrictionsModal({
    open,
    onOpenChange,
    productName,
    restrictions,
    onRetry,
    isRetrying = false
}: ArchivingRestrictionsModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title={
                <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    No se puede archivar el producto
                </div>
            }
            footer={
                <div className="flex gap-2 w-full justify-end">
                    <CancelButton onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                        Cerrar
                    </CancelButton>
                    {onRetry && (
                        <SubmitButton
                            onClick={onRetry}
                            loading={isRetrying}
                            className="flex-1 sm:flex-none"
                            icon={<RefreshCcw className="h-4 w-4 mr-2" />}
                            type="button"
                        >
                            Reintentar Archivado
                        </SubmitButton>
                    )}
                </div>
            }
        >
            <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                    El producto <strong>{productName}</strong> tiene dependencias activas que deben resolverse antes de poder archivarlo.
                </p>

                <div className="space-y-4 py-4">
                    {restrictions.map((restriction, index) => (
                        <div
                            key={index}
                            className="flex items-start justify-between p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Chip size="xs">{restriction.label}</Chip>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {restriction.description}
                                </p>
                                {restriction.action_hint && (
                                    <p className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded inline-block">
                                        💡 {restriction.action_hint}
                                    </p>
                                )}
                            </div>
                            <Link href={restriction.link} target="_blank">
                                <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:text-primary hover:bg-primary/10">
                                    <span className="text-xs">Ver</span>
                                    <ExternalLink className="h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </BaseModal>
    )
}
