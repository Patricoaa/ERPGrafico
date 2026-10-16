"use client"

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, ExternalLink } from 'lucide-react'
import { hasEntityDrawer } from '@/lib/entity-drawers'
import { isListSelectionUrl } from '@/lib/documentNavigation'
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
    const router = useRouter()

    const label = doc.display ?? doc.name ?? `#${doc.id}`

    const baseStyle = `inline-flex items-center gap-1 text-primary underline font-medium hover:text-primary/80 text-sm ${className}`

    // 1. Canonical list navigation (preferred): URL + module follow the relationship (ADR-0086)
    if (isListSelectionUrl(doc.url)) {
        const go = () => router.push(doc.url as string, { scroll: false })
        return (
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); go() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); go() } }}
                className={`${baseStyle} cursor-pointer`}
            >
                {showIcon && <FileText className="h-3.5 w-3.5" />}
                {label}
                <ExternalLink className="h-3 w-3" />
            </span>
        )
    }

    // 2. Drawer drill-down (in-memory stack with "volver")
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
