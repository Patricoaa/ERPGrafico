import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { FileText, Package, UserRound } from "lucide-react"
import { EntityCard } from "./EntityCard"
import { StatusBadge } from "./StatusBadge"

const meta = {
    title: "Shared/EntityCard",
    component: EntityCard,
    args: { children: null },
} satisfies Meta<typeof EntityCard>
export default meta
type Story = StoryObj<typeof meta>

/** Role `item`: opens a record. Hover only borders it; the ribbon appears once it is the open one. */
export const ItemStates: Story = {
    render: () => {
        const [open, setOpen] = useState<string | null>("ov-2")
        const docs = [
            { id: "ov-1", code: "OV-0011", client: "Imprenta Sur Ltda.", total: "$ 1.240.000", status: "DRAFT" },
            { id: "ov-2", code: "OV-0012", client: "Editorial Andes SpA", total: "$ 860.500", status: "IN_PROGRESS" },
            { id: "ov-3", code: "OV-0013", client: "Gráfica del Norte", total: "$ 312.900", status: "DELIVERED" },
        ]
        return (
            <ul className="grid w-[56rem] grid-cols-3 gap-3">
                {docs.map((d) => (
                    <li key={d.id} className="@container min-w-0">
                        <EntityCard variant="compact" isSelected={open === d.id} onClick={() => setOpen(d.id)}>
                            <EntityCard.Header
                                icon={FileText}
                                iconClassName="text-info bg-info/10"
                                title={d.code}
                                subtitle={d.client}
                                trailing={<StatusBadge status={d.status} size="sm" />}
                            />
                            <EntityCard.Metrics metrics={[{ label: "Total", value: d.total }]} />
                        </EntityCard>
                    </li>
                ))}
            </ul>
        )
    },
}

/** Media on top and bulk selection (checkbox always visible). */
export const MediaAndBulk: Story = {
    render: () => {
        const [checked, setChecked] = useState<string[]>(["p-2"])
        const items = [
            { id: "p-1", name: "Papel couché 150 g", sku: "PAP-0150" },
            { id: "p-2", name: "Plancha CTP 510×400", sku: "PLA-0510" },
        ]
        return (
            <ul className="grid w-[40rem] grid-cols-2 gap-3">
                {items.map((p) => (
                    <li key={p.id} className="min-w-0">
                        <EntityCard
                            variant="compact"
                            selectable
                            isAnySelected
                            checked={checked.includes(p.id)}
                            onCheckedChange={(v) => setChecked((c) => (v ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                            selectionLabel={`Seleccionar ${p.name}`}
                            onClick={() => {}}
                        >
                            <EntityCard.Media icon={Package} iconClassName="bg-muted text-muted-foreground" badge={p.sku} />
                            <EntityCard.Header title={p.name} subtitle="Inventario" />
                            <EntityCard.Meta items={[{ key: "stock", label: "Stock", value: "120 un" }, { key: "min", label: "Mínimo", value: "20 un" }]} />
                        </EntityCard>
                    </li>
                ))}
            </ul>
        )
    },
}

/** Non-interactive card with an avatar-less contact lead. */
export const Static: Story = {
    render: () => (
        <div className="w-80">
            <EntityCard variant="compact">
                <EntityCard.Header icon={UserRound} title="María Soto" subtitle="Cliente · 76.123.456-7" />
            </EntityCard>
        </div>
    ),
}

/** Skeletons matching real card anatomies and dimensions. */
export const Skeletons: Story = {
    render: () => (
        <ul className="grid w-[56rem] grid-cols-3 gap-3">
            <li className="@container min-w-0">
                <EntityCard.Skeleton
                    variant="compact"
                    lead
                    subtitle
                    trailing
                    metrics={1}
                />
            </li>
            <li className="@container min-w-0">
                <EntityCard.Skeleton
                    variant="compact"
                    media
                    subtitle
                    meta
                    metaCount={2}
                    foot
                />
            </li>
            <li className="@container min-w-0">
                <EntityCard.Skeleton
                    variant="compact"
                    rail
                    subtitle
                    trailing
                    highlights
                    highlightsCount={1}
                    meta
                    metaCount={2}
                />
            </li>
        </ul>
    ),
}
