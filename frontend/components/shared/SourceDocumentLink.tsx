"use client"

import React from 'react'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'
import { opensInApp, useOpenDocument } from '@/hooks/useOpenDocument'

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
    const openDocument = useOpenDocument()

    const label = doc.display ?? doc.name ?? `#${doc.id}`

    const baseStyle = `inline-flex items-center gap-1 text-primary underline font-medium hover:text-primary/80 text-sm ${className}`

    // La regla (abrir como pestaña) vive en useOpenDocument (ADR-0100). Con ficha registrada el enlace
    // es interactivo; sin ficha, cae al <Link>.
    const open = () => openDocument({ label: doc.type, id: doc.id, display: label, url: doc.url })
    if (opensInApp({ label: doc.type, url: doc.url })) {
        return (
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); open() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); open() } }}
                className={`${baseStyle} cursor-pointer`}
            >
                {showIcon && <FileText className="h-3.5 w-3.5" />}
                {label}
                <ExternalLink className="h-3 w-3" />
            </span>
        )
    }

    // 3. Navigation fallback
    if (doc.url && doc.url !== "#") {
        return (
            <Link href={doc.url} className={baseStyle}>
                {showIcon && <FileText className="h-3.5 w-3.5" />}
                {label}
                <ExternalLink className="h-3 w-3" />
            </Link>
        )
    }

    // 4. Plain text (no interaction)
    return (
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            {showIcon && <FileText className="h-3.5 w-3.5" />}
            {label}
        </span>
    )
}

SourceDocumentLink.displayName = 'SourceDocumentLink'
