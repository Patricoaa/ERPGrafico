"use client"

import React from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { AlertCircle, ExternalLink, Package } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCcw } from "lucide-react"

export interface Restriction {
    type: string
    label: string
    description: string
    action_hint?: string
    count: number
    link: string
}

interface ArchivingRestrictionsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    productName: string
    restrictions: Restriction[]
    onRetry?: () => void
    isRetrying?: boolean
}

export function ArchivingRestrictionsDialog({
    open,
    onOpenChange,
    productName,
    restrictions,
    onRetry,
    isRetrying = false
}: ArchivingRestrictionsDialogProps) {
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                        Cerrar
                    </Button>
                    {onRetry && (
                        <Button
                            onClick={onRetry}
                            disabled={isRetrying}
                            className="flex-1 sm:flex-none"
                        >
                            {isRetrying ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <RefreshCcw className="h-4 w-4 mr-2" />
                            )}
                            Reintentar Archivado
                        </Button>
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
                            className="flex items-start justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                        {restriction.label}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {restriction.description}
                                </p>
                                {restriction.action_hint && (
                                    <p className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
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
