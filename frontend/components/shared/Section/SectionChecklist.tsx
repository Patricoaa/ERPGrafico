"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleAlert, type LucideIcon } from "lucide-react"

import { getEntityMetadata } from "@/lib/entity-registry"
import { formatPlainDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MoneyDisplay } from "../MoneyDisplay"
import { SectionAction } from "./SectionAction"
import { SectionRoot } from "./SectionRoot"
import { SectionRow } from "./SectionRow"

export type SectionChecklistDocumentLabel =
    | "accounting.journalentry"
    | "billing.invoice"
    | "hr.payroll"
    | "treasury.bankstatement"

export interface SectionChecklistDocument {
    id: number
    label: string
    amount: string | null
    date: string | null
}

export interface SectionChecklistItem {
    key: string
    title: string
    passed: boolean
    detail?: string
    /** Documentos pendientes: los listados y el total real (puede superar lo listado). */
    pending?: { label: SectionChecklistDocumentLabel; documents: SectionChecklistDocument[]; total: number }
    action?: { text: string; onClick?: () => void; href?: string; variant?: "outline" | "ghost"; icon?: LucideIcon }
}

function StateIcon({ passed, critical }: { passed: boolean; critical: boolean }) {
    if (passed) return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
    if (critical) return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
    return <CircleAlert className="h-4 w-4 text-warning" aria-hidden />
}

export interface SectionChecklistProps {
    title: string
    items: SectionChecklistItem[]
    /** Obligatorios (bloquean) → icono destructivo; sugeridos → advertencia. */
    critical: boolean
    expanded: ReadonlySet<string>
    onToggle: (key: string) => void
    onOpenDocument: (label: SectionChecklistDocumentLabel, id: number) => void
}

function PendingDocuments({ pending, onOpenDocument }: { pending: NonNullable<SectionChecklistItem["pending"]>; onOpenDocument: SectionChecklistProps["onOpenDocument"] }) {
    const hidden = pending.total - pending.documents.length
    const listUrl = getEntityMetadata(pending.label)?.listUrl
    return (
        <ul>
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
                    <Link href={listUrl} className="text-primary underline-offset-2 hover:underline">{`y ${hidden} más`}</Link>
                </li>
            )}
        </ul>
    )
}

/**
 * Checklist previo a un cierre: filas con estado, detalle, CTA y los documentos pendientes
 * desplegables. Lo usan el cierre contable y la auditoría del wizard F29.
 */
export function SectionChecklist({ title, items, critical, expanded, onToggle, onOpenDocument }: SectionChecklistProps) {
    const done = items.filter(item => item.passed).length
    return (
        <SectionRoot title={title} count={`${done} de ${items.length}`}>
            {items.map(item => {
                const pending = item.pending && item.pending.total > 0 ? item.pending : null
                return (
                    <SectionRow
                        key={item.key}
                        leading={<StateIcon passed={item.passed} critical={critical} />}
                        title={item.title}
                        meta={item.passed ? "Listo" : "Pendiente"}
                        description={item.detail}
                        expand={pending ? {
                            label: `Ver ${pending.total} ${pending.total === 1 ? "pendiente" : "pendientes"}`,
                            expanded: expanded.has(item.key),
                            onToggle: () => onToggle(item.key),
                            content: <PendingDocuments pending={pending} onOpenDocument={onOpenDocument} />,
                        } : undefined}
                        actions={item.action && (
                            <SectionAction
                                text={item.action.text}
                                icon={item.action.icon}
                                href={item.action.href}
                                onClick={item.action.onClick}
                                variant={item.action.variant ?? "outline"}
                            />
                        )}
                    />
                )
            })}
        </SectionRoot>
    )
}
