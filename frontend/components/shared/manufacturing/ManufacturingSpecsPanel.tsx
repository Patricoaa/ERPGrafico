"use client"

/**
 * ManufacturingSpecsPanel
 *
 * Read-only summary of a manufacturing configuration. One projection, two hosts:
 *   - Work-order wizard right rail (data comes from the persisted order)
 *   - POS manufacturing drawer (data comes from the in-progress draft)
 *
 * Hosts map their own data into `ManufacturingSpecsView`; the panel never knows
 * where the data came from.
 */

import type { ReactNode } from "react"
import { Building2, CalendarCheck, CalendarIcon, FileIcon, FileText, Hash, Layers, Package, Paintbrush, Printer, Receipt, Sparkles, User, Wrench } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { getDomainConceptTitle } from "@/lib/entity-registry"

export interface ManufacturingSpecsView {
  product?: { name: string; quantity?: number | string | null; uomName?: string | null }
  productDescription?: string | null
  /** Display label of the associated sale order (e.g. "NV-0042"); omitted for a manual OT. */
  saleOrder?: string | null
  /** Customer of the associated sale order. */
  customer?: { name: string; taxId?: string | null } | null
  /** Related contact the work order is assigned to (e.g. the end client of an intermediary customer). */
  contact?: { name: string; taxId?: string | null } | null
  phases?: { prepress?: boolean; press?: boolean; postpress?: boolean }
  specifications?: { prepress?: string; press?: string; postpress?: string }
  designNeeded?: boolean
  designFiles?: string[]
  /** Openable URL per design file name, when the files are already uploaded (open in a new tab). */
  designFileUrls?: Record<string, string>
  folioEnabled?: boolean
  folioStart?: string
  /** ISO dates (yyyy-MM-dd). */
  createdAt?: string | null
  requestedDelivery?: string | null
  printType?: "offset" | "digital" | "especial" | null
}

const PRINT_TYPE_LABEL: Record<NonNullable<ManufacturingSpecsView["printType"]>, string> = {
  offset: "Offset",
  digital: "Digital",
  especial: "Especial",
}

type IconType = React.ComponentType<{ className?: string }>

function Section({ icon: Icon, title, children }: { icon: IconType; title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <h3 className="pb-2 mb-3 border-b border-border/40 flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** One field: icon + label on top, value below. Every value uses the same `text-xs` type. */
function Row({ label, icon: Icon, children }: { label: string; icon: IconType; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground leading-none mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        {label}
      </p>
      <div className="pl-5 text-xs text-foreground leading-snug break-words">{children}</div>
    </div>
  )
}

function Party({ party }: { party: { name: string; taxId?: string | null } }) {
  return (
    <>
      <p>{party.name}</p>
      {hasText(party.taxId) && <p className="text-muted-foreground tabular-nums">{party.taxId}</p>}
    </>
  )
}

const hasText = (v?: string | null): v is string => !!v && v.trim().length > 0

export function ManufacturingSpecsPanel({ view, className }: { view: ManufacturingSpecsView; className?: string }) {
  const { product, customer, contact, phases, specifications, designFiles = [] } = view
  const qty = product?.quantity
  const hasQty = qty !== undefined && qty !== null && qty !== "" && Number(qty) > 0

  const stages = [
    { key: "prepress", icon: Paintbrush, label: "Pre-Impresión", on: phases?.prepress || view.designNeeded || view.folioEnabled || designFiles.length > 0, spec: specifications?.prepress },
    { key: "press", icon: Printer, label: "Impresión", on: phases?.press, spec: specifications?.press },
    { key: "postpress", icon: FileText, label: "Post-Impresión", on: phases?.postpress, spec: specifications?.postpress },
  ].filter(s => s.on || hasText(s.spec))

  const isEmpty = !view.printType && stages.length === 0

  return (
    <div className={className}>
      {(product || view.saleOrder || customer || contact || view.createdAt || view.requestedDelivery) && (
        <Section icon={Layers} title="Información">
          {product && (
            <Row label="Producto" icon={Package}>
              <p>
                {hasQty && <span className="tabular-nums">{qty} {product.uomName ?? "und"} × </span>}
                {product.name}
              </p>
              {hasText(view.productDescription) && (
                <p className="mt-0.5 text-muted-foreground line-clamp-3">{view.productDescription}</p>
              )}
            </Row>
          )}
          {hasText(view.saleOrder) && (
            <Row label={getDomainConceptTitle("ov")} icon={Receipt}>
              <span className="tabular-nums">{view.saleOrder}</span>
            </Row>
          )}
          {customer && (
            <Row label="Cliente" icon={Building2}>
              <Party party={customer} />
            </Row>
          )}
          {contact && (
            <Row label="Contacto relacionado" icon={User}>
              <Party party={contact} />
            </Row>
          )}
          {view.createdAt && (
            <Row label="Fecha de creación" icon={CalendarIcon}>
              <span className="tabular-nums">{formatPlainDate(view.createdAt)}</span>
            </Row>
          )}
          {view.requestedDelivery && (
            <Row label="Entrega solicitada" icon={CalendarCheck}>
              <span className="tabular-nums">{formatPlainDate(view.requestedDelivery)}</span>
            </Row>
          )}
        </Section>
      )}

      <Section icon={Wrench} title="Especificaciones">
        {isEmpty && <p className="text-xs text-muted-foreground">Sin especificaciones registradas</p>}

        {view.printType && <Row label="Tecnología" icon={Printer}>{PRINT_TYPE_LABEL[view.printType]}</Row>}
        {stages.map(s => (
          <Row key={s.key} label={s.label} icon={s.icon}>
            {hasText(s.spec) ? <p className="whitespace-pre-line">{s.spec}</p> : <p className="text-muted-foreground">Sin indicaciones adicionales</p>}
            {/* Design, numbering and files are pre-press specifications: always stated, yes or no. */}
            {s.key === "prepress" && (
              <ul className="mt-1.5 space-y-1">
                <li className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                  {view.designNeeded ? "Diseño requerido" : "Sin diseño requerido"}
                </li>
                <li className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                  <span className="tabular-nums">
                    {view.folioEnabled ? (hasText(view.folioStart) ? `Folios desde ${view.folioStart}` : "Folios numerados") : "Sin folios"}
                  </span>
                </li>
                {designFiles.map((name, i) => {
                  const url = view.designFileUrls?.[name]
                  return (
                    <li key={`${name}-${i}`} className="flex min-w-0 items-center gap-1.5">
                      <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      {url
                        ? <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline-offset-2 hover:underline">{name}</a>
                        : <span className="truncate">{name}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Row>
        ))}
      </Section>
    </div>
  )
}
