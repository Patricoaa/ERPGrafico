"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, type LucideIcon } from "lucide-react"

import { MoneyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { getEntityMetadata } from "@/lib/entity-registry"
import { formatPlainDate } from "@/lib/utils"

export type PendingDocumentLabel =
    | "accounting.journalentry"
    | "billing.invoice"
    | "hr.payroll"
    | "treasury.bankstatement"

export interface PendingChecklistDocument {
    id: number
    label: string
    amount: string | null
    date: string | null
}

export interface PendingChecklistItem {
    key: string
    title: string
    passed: boolean
    detail?: string
    /** Documentos pendientes: los listados y el total real (puede superar lo listado). */
    pending?: { label: PendingDocumentLabel; documents: PendingChecklistDocument[]; total: number }
    action?: { text: string; onClick?: () => void; href?: string; variant?: "outline" | "ghost"; icon?: LucideIcon }
}

function StateIcon({ passed, critical }: { passed: boolean; critical: boolean }) {
    if (passed) return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
    if (critical) return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
    return <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
}

interface PendingChecklistRowProps {
    item: PendingChecklistItem
    critical: boolean
    expanded: boolean
    onToggle: () => void
    onOpenDocument: (label: PendingDocumentLabel, id: number) => void
}

function PendingChecklistRow({ item, critical, expanded, onToggle, onOpenDocument }: PendingChecklistRowProps) {
    const pending = item.pending && item.pending.total > 0 ? item.pending : null
    const hidden = pending ? pending.total - pending.documents.length : 0
    const listUrl = pending ? getEntityMetadata(pending.label)?.listUrl : undefined
    const ActionIcon = item.action?.icon
    const Chevron = expanded ? ChevronDown : ChevronRight

    return (
        <li className="py-2.5">
            <div className="flex items-start gap-3">
                <span className="mt-0.5"><StateIcon passed={item.passed} critical={critical} /></span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-2xs text-muted-foreground">{item.passed ? "Listo" : "Pendiente"}</span>
                    </div>
                    {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                </div>
                {pending && (
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={onToggle} aria-expanded={expanded}>
                        <Chevron className="h-3.5 w-3.5" aria-hidden />
                        {`Ver ${pending.total} ${pending.total === 1 ? "pendiente" : "pendientes"}`}
                    </Button>
                )}
                {item.action && (item.action.href ? (
                    <Button variant={item.action.variant ?? "outline"} size="sm" className="h-7 shrink-0 gap-1 text-xs" asChild>
                        <Link href={item.action.href}>{ActionIcon && <ActionIcon className="h-3.5 w-3.5" aria-hidden />}{item.action.text}</Link>
                    </Button>
                ) : (
                    <Button variant={item.action.variant ?? "outline"} size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={item.action.onClick}>
                        {ActionIcon && <ActionIcon className="h-3.5 w-3.5" aria-hidden />}
                        {item.action.text}
                    </Button>
                ))}
            </div>
            {pending && expanded && (
                <ul className="mt-2 ml-7 border-l border-border pl-3">
                    {pending.documents.map(doc => (
                        <li key={doc.id}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto w-full justify-start gap-3 px-2 py-1 text-left text-xs font-normal"
                                onClick={() => onOpenDocument(pending.label, doc.id)}
                            >
                                <span className="min-w-0 flex-1 truncate">{doc.label}</span>
                                {doc.date && <span className="shrink-0 text-muted-foreground tabular-nums">{formatPlainDate(doc.date)}</span>}
                                {doc.amount !== null && <MoneyDisplay amount={doc.amount} showColor={false} className="shrink-0 text-xs" />}
                            </Button>
                        </li>
                    ))}
                    {hidden > 0 && listUrl && (
                        <li className="px-2 py-1 text-xs">
                            <Link href={listUrl} className="text-primary underline-offset-2 hover:underline">
                                {`y ${hidden} más`}
                            </Link>
                        </li>
                    )}
                </ul>
            )}
        </li>
    )
}

interface PendingChecklistSectionProps {
    title: string
    items: PendingChecklistItem[]
    /** Obligatorios (bloquean) → icono destructivo; sugeridos → advertencia. */
    critical: boolean
    expanded: ReadonlySet<string>
    onToggle: (key: string) => void
    onOpenDocument: (label: PendingDocumentLabel, id: number) => void
}

/**
 * Sección de un checklist previo a un cierre: filas densas con estado, detalle, CTA y los
 * documentos pendientes expandibles. La usan el checklist del cierre contable y la auditoría del
 * wizard F29 para que ambos se vean y se comporten igual.
 */
export function PendingChecklistSection({ title, items, critical, expanded, onToggle, onOpenDocument }: PendingChecklistSectionProps) {
    const id = `checklist-section-${title.toLowerCase()}`
    const done = items.filter(item => item.passed).length
    return (
        <section aria-labelledby={id}>
            <div className="flex items-baseline justify-between border-b border-border pb-1">
                <h3 id={id} className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
                <span className="text-2xs text-muted-foreground tabular-nums">{`${done} de ${items.length}`}</span>
            </div>
            <ul className="divide-y divide-border">
                {items.map(item => (
                    <PendingChecklistRow
                        key={item.key}
                        item={item}
                        critical={critical}
                        expanded={expanded.has(item.key)}
                        onToggle={() => onToggle(item.key)}
                        onOpenDocument={onOpenDocument}
                    />
                ))}
            </ul>
        </section>
    )
}
