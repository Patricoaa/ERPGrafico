"use client"

import React from 'react'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'
import { hasEntityDrawer } from '@/lib/entity-drawers'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'

interface SourceDocument {
    type: string
    id: number
    name?: string
    display?: string
    url?: string
}

interface SourceDocumentLinkProps {
    doc: SourceDocument
    showIcon?: boolean
    className?: string
}

export const SourceDocumentLink: React.FC<SourceDocumentLinkProps> = ({
    doc,
    showIcon = true,
    className = "",
}) => {
    const { openEntity } = useGlobalModals()

    const label = doc.display ?? doc.name ?? `#${doc.id}`

    const baseStyle = `inline-flex items-center gap-1 text-primary underline font-medium hover:text-primary/80 text-sm ${className}`

    // 1. Drawer drill-down (preferred)
    if (hasEntityDrawer(doc.type)) {
        return (
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); openEntity(doc.type, doc.id, doc) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openEntity(doc.type, doc.id, doc) } }}
                className={`${baseStyle} cursor-pointer`}
            >
                {showIcon && <FileText className="h-3.5 w-3.5" />}
                {label}
                <ExternalLink className="h-3 w-3" />
            </span>
        )
    }

    // 2. Navigation fallback
    if (doc.url && doc.url !== "#") {
        return (
            <Link href={doc.url} className={baseStyle}>
                {showIcon && <FileText className="h-3.5 w-3.5" />}
                {label}
                <ExternalLink className="h-3 w-3" />
            </Link>
        )
    }

    // 3. Plain text (no interaction)
    return (
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            {showIcon && <FileText className="h-3.5 w-3.5" />}
            {label}
        </span>
    )
}

SourceDocumentLink.displayName = 'SourceDocumentLink'
