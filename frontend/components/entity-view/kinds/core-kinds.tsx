"use client"

import { DataCell, DomainHubStatus, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"
import {
    EMPTY,
    formatDate,
    formatDateRange,
    formatFlow,
    formatMoneyValue,
    formatNumber,
    formatProgress,
    formatStatus,
    formatTags,
    formatText,
    toNumber,
} from "../core/formatters"
import { registerValueKind, type Align } from "../core/value-kinds"
import { ALIGN_FLEX } from "../core/align"

/** Maps the semantic alignment onto DataCell's flex container (DataCell centers by default). */
const ALIGN_CLASS = ALIGN_FLEX
/** Uniform missing value ("—", secondary tone) for every kind; DataCell renders "-" for null. */
function EmptyCell({ align }: { align: Align }) {
    return <DataCell.Secondary className={ALIGN_CLASS[align]}>{EMPTY}</DataCell.Secondary>
}

let registered = false

/** Registers the core kinds. Idempotent; called by the barrel on import. */
export function registerCoreValueKinds(): void {
    if (registered) return
    registered = true

    registerValueKind("text", {
        format: (v) => formatText(v),
        render: ({ value, options, align }) => {
            const Cell = options.tone === "secondary" ? DataCell.Secondary : DataCell.Text
            return <Cell className={cn(ALIGN_CLASS[align], options.truncate && "truncate")}>{formatText(value)}</Cell>
        },
    })

    registerValueKind("code", {
        format: (v, o) => formatText(v, o.prefix),
        render: ({ value, options, align }) => (
            <DataCell.Code className={ALIGN_CLASS[align]}>{formatText(value, options.prefix)}</DataCell.Code>
        ),
    })

    registerValueKind("number", {
        format: (v, o) => formatNumber(v, o.decimals, o.suffix),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) =>
            toNumber(value) === null ? <EmptyCell align={align} /> : (
                <DataCell.Number value={value} decimals={options.decimals} suffix={options.suffix} className={ALIGN_CLASS[align]} />
            ),
    })

    registerValueKind("quantity", {
        format: (v, o) => formatNumber(v, o.decimals, o.uom ?? undefined),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) =>
            toNumber(value) === null ? <EmptyCell align={align} /> : (
                <DataCell.Number value={value} decimals={options.decimals} suffix={options.uom ?? undefined} className={ALIGN_CLASS[align]} />
            ),
    })

    registerValueKind("money", {
        format: (v, o) => formatMoneyValue(v, o.currency, o.sign),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) =>
            toNumber(value) === null ? <EmptyCell align={align} /> : (
                <DataCell.Currency value={value} currency={options.currency} className={ALIGN_CLASS[align]} />
            ),
    })

    registerValueKind("flow", {
        format: (v, o) => formatFlow(v, o.direction, o.currency),
        sortValue: (v, o) => {
            const n = toNumber(v)
            if (n === null) return null
            return o.direction === "outflow" ? -Math.abs(n) : Math.abs(n)
        },
        align: "end",
        render: ({ value, options, align }) => {
            const n = toNumber(value)
            if (n === null) return <EmptyCell align={align} />
            return <DataCell.CurrencyFlow value={n} direction={options.direction} currency={options.currency} className={ALIGN_CLASS[align]} />
        },
    })

    registerValueKind("date", {
        format: (v, o) => formatDate(v, o.time),
        sortValue: (v) => v ?? null,
        render: ({ value, options, align }) =>
            value ? (
                <DataCell.Date value={value} showTime={options.time} className={ALIGN_CLASS[align]} />
            ) : (
                <EmptyCell align={align} />
            ),
    })

    registerValueKind("dateRange", {
        format: (v) => formatDateRange(v),
        sortValue: (v) => v?.from ?? null,
        render: ({ value, align }) => (value ? <DataCell.Text className={ALIGN_CLASS[align]}>{formatDateRange(value)}</DataCell.Text> : <EmptyCell align={align} />),
    })

    registerValueKind("status", {
        format: (v) => formatStatus(v),
        sortValue: (v) => v?.status ?? null,
        align: "center",
        render: ({ value, align }) =>
            value ? (
                <div className={cn("flex w-full", ALIGN_CLASS[align])}>
                    <StatusBadge status={value.status} label={value.label} intent={value.intent} size="sm" />
                </div>
            ) : (
                <EmptyCell align={align} />
            ),
    })

    registerValueKind("hubStatus", {
        // Readable label first (StatusBadge, also used for text, sort and export), axes rings after it:
        // table and card share one status vocabulary (Gate C decision).
        format: (v, o) => (v ? formatStatus(o.caption) : EMPTY),
        sortValue: (v, o) => (v ? formatStatus(o.caption) : null),
        align: "start",
        render: ({ value, options, align }) =>
            value ? (
                <div className={cn("flex w-full items-center gap-2", ALIGN_CLASS[align])}>
                    <StatusBadge status={options.caption.status} label={options.caption.label} intent={options.caption.intent} size="sm" />
                    <DomainHubStatus label={options.entity} data={value} />
                </div>
            ) : (
                <EmptyCell align={align} />
            ),
    })

    registerValueKind("contact", {
        format: (v) => (v ? v.name : EMPTY),
        sortValue: (v) => v?.name ?? null,
        render: ({ value, align }) =>
            value ? (
                <DataCell.ContactLink contactId={value.id} className={ALIGN_CLASS[align]}>{value.name}</DataCell.ContactLink>
            ) : (
                <EmptyCell align={align} />
            ),
    })

    registerValueKind("tags", {
        format: (v) => formatTags(v),
        // DataCell.Category needs a domain (it renders "-" without one): free tags use neutral chips.
        render: ({ value, options, align }) => {
            if (options.domain) return <DataCell.Category value={value ? [...value] : null} domain={options.domain} className={ALIGN_CLASS[align]} />
            if (!value || value.length === 0) return <EmptyCell align={align} />
            // One line: the first two chips plus "+N" keep row height stable (full list in the title attribute).
            const shown = value.slice(0, 2)
            return (
                <div className={cn("flex w-full flex-nowrap items-center gap-1 overflow-hidden", ALIGN_CLASS[align])} title={value.join(", ")}>
                    {shown.map((tag) => <DataCell.Chip key={tag} size="sm">{tag}</DataCell.Chip>)}
                    {value.length > shown.length && <span className="text-xs text-muted-foreground">+{value.length - shown.length}</span>}
                </div>
            )
        },
    })

    registerValueKind("progress", {
        format: (v, o) => formatProgress(v, o.format),
        sortValue: (v) => (v && v.total > 0 ? v.done / v.total : null),
        // DataCell.Progress is visual only: the wrapper exposes the progressbar semantics (AX-7).
        render: ({ value, options, label }) =>
            value ? (
                <div
                    role="progressbar"
                    aria-label={label}
                    aria-valuemin={0}
                    aria-valuemax={value.total > 0 ? value.total : 1}
                    aria-valuenow={value.done}
                    aria-valuetext={formatProgress(value, options.format)}
                    className="w-full"
                >
                    <DataCell.Progress value={value.done} max={value.total > 0 ? value.total : 1} label={formatProgress(value, options.format)} />
                </div>
            ) : (
                <EmptyCell align="start" />
            ),
    })
}
