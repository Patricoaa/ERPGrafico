"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, ExternalLink, Package } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export interface Restriction {
    type: string
    label: string
    description: string
    count: number
    link: string
}

interface ArchivingRestrictionsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    productName: string
    restrictions: Restriction[]
}

export function ArchivingRestrictionsDialog({
    open,
    onOpenChange,
    productName,
    restrictions
}: ArchivingRestrictionsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        No se puede archivar el producto
                    </DialogTitle>
                    <DialogDescription>
                        El producto <strong>{productName}</strong> tiene dependencias activas que deben resolverse antes de poder archivarlo.
                    </DialogDescription>
                </DialogHeader>

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

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                        Entendido
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
