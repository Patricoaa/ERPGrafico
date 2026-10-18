"use client"

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
    isMissing,
    toNumber,
} from "../core/formatters"
import { registerValueKind } from "../core/value-kinds"
import { ALIGN_FLEX } from "../core/align"
// After the core imports (see index.ts): the shared graph may re-enter this barrel.
import { DataCell, DomainHubStatus, StatusBadge } from "@/components/shared"
import { cn } from "@/lib/utils"

/** Code content: `null` when missing so DataCell.Code renders its own empty marker. */
const codeContent = (value: string | number | null | undefined, prefix?: string) => (isMissing(value) ? null : formatText(value, prefix))

let registered = false

/** Registers the core kinds. Idempotent; called by the barrel on import. */
export function registerCoreValueKinds(): void {
    if (registered) return
    registered = true

    registerValueKind("text", {
        format: (v) => formatText(v),
        render: ({ value, options, align }) => {
            const Cell = options.tone === "secondary" ? DataCell.Secondary : DataCell.Text
            if (isMissing(value)) return <DataCell.Empty align={align} />
            return <Cell align={align} className={cn(options.truncate && "truncate")}>{formatText(value)}</Cell>
        },
        inline: ({ value }) => (isMissing(value) ? <DataCell.Empty inline /> : <DataCell.Text inline>{formatText(value)}</DataCell.Text>),
    })

    registerValueKind("code", {
        format: (v, o) => formatText(v, o.prefix),
        render: ({ value, options, align }) => (
            <DataCell.Code align={align}>{codeContent(value, options.prefix)}</DataCell.Code>
        ),
        inline: ({ value, options }) => <DataCell.Code inline>{codeContent(value, options.prefix)}</DataCell.Code>,
    })

    registerValueKind("number", {
        format: (v, o) => formatNumber(v, o.decimals, o.suffix),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) => (
            <DataCell.Number value={toNumber(value)} decimals={options.decimals} suffix={options.suffix} align={align} />
        ),
    })

    registerValueKind("quantity", {
        format: (v, o) => formatNumber(v, o.decimals, o.uom ?? undefined),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) => (
            <DataCell.Number value={toNumber(value)} decimals={options.decimals} suffix={options.uom ?? undefined} align={align} />
        ),
    })

    registerValueKind("money", {
        format: (v, o) => formatMoneyValue(v, o.currency, o.sign),
        sortValue: (v) => toNumber(v),
        align: "end",
        render: ({ value, options, align }) => (
            <DataCell.Currency value={toNumber(value)} currency={options.currency} align={align} />
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
            if (n === null) return <DataCell.Empty align={align} />
            return <DataCell.CurrencyFlow value={n} direction={options.direction} currency={options.currency} align={align} />
        },
    })

    registerValueKind("date", {
        format: (v, o) => formatDate(v, o.time),
        sortValue: (v) => v ?? null,
        render: ({ value, options, align }) => <DataCell.Date value={value ?? null} showTime={options.time} align={align} />,
    })

    registerValueKind("dateRange", {
        format: (v) => formatDateRange(v),
        sortValue: (v) => v?.from ?? null,
        render: ({ value, align }) => (value ? <DataCell.Text align={align}>{formatDateRange(value)}</DataCell.Text> : <DataCell.Empty align={align} />),
    })

    registerValueKind("status", {
        format: (v) => formatStatus(v),
        sortValue: (v) => v?.status ?? null,
        align: "center",
        render: ({ value, align }) =>
            value ? (
                <div className={cn("flex w-full", ALIGN_FLEX[align])}>
                    <StatusBadge status={value.status} label={value.label} intent={value.intent} size="sm" />
                </div>
            ) : (
                <DataCell.Empty align={align} />
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
                <div className={cn("flex w-full items-center gap-2", ALIGN_FLEX[align])}>
                    <StatusBadge status={options.caption.status} label={options.caption.label} intent={options.caption.intent} size="sm" />
                    <DomainHubStatus label={options.entity} data={value} />
                </div>
            ) : (
                <DataCell.Empty align={align} />
            ),
    })

    registerValueKind("contact", {
        format: (v) => (v ? v.name : EMPTY),
        sortValue: (v) => v?.name ?? null,
        render: ({ value, align }) =>
            value ? (
                // Without an id there is nothing to open: plain text, not a link that does nothing.
                value.id ? <DataCell.ContactLink contactId={value.id} align={align}>{value.name}</DataCell.ContactLink> : <DataCell.Text align={align}>{value.name}</DataCell.Text>
            ) : (
                <DataCell.Empty align={align} />
            ),
    })

    registerValueKind("tags", {
        format: (v) => formatTags(v),
        // DataCell.Category needs a domain (it renders "-" without one): free tags use neutral chips.
        render: ({ value, options, align }) => {
            if (options.domain) return <DataCell.Category value={value ? [...value] : null} domain={options.domain} align={align} />
            if (!value || value.length === 0) return <DataCell.Empty align={align} />
            // One line: the first two chips plus "+N" keep row height stable (full list in the title attribute).
            const shown = value.slice(0, 2)
            return (
                <div className={cn("flex w-full flex-nowrap items-center gap-1 overflow-hidden", ALIGN_FLEX[align])} title={value.join(", ")}>
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
                <DataCell.Empty align="start" />
            ),
    })
}
