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
import { Building2, CalendarCheck, CalendarIcon, FileIcon, FileText, Hash, Layers, Package, Paintbrush, Printer, User, Wrench } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"

export interface ManufacturingSpecsView {
  product?: { name: string; quantity?: number | string | null; uomName?: string | null }
  productDescription?: string | null
  /** Customer of the associated sale order. */
  customer?: { name: string; taxId?: string | null } | null
  /** Related contact the work order is assigned to (e.g. the end client of an intermediary customer). */
  contact?: { name: string; taxId?: string | null } | null
  phases?: { prepress?: boolean; press?: boolean; postpress?: boolean }
  specifications?: { prepress?: string; press?: string; postpress?: string }
  designNeeded?: boolean
  designFiles?: string[]
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

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <h3 className="pb-2 mb-2 border-b border-border/40 flex items-center gap-2 text-2xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

type IconType = React.ComponentType<{ className?: string }>

function Row({ label, icon: Icon, children, mono }: { label: string; icon?: IconType; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        {label}
      </p>
      <div className={cn("text-xs font-medium text-foreground leading-snug break-words", mono && "font-mono tabular-nums")}>{children}</div>
    </div>
  )
}

function PartyLine({ party, icon: Icon }: { party: { name: string; taxId?: string | null }; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-px shrink-0 text-muted-foreground/60" />
      <div className="min-w-0">
        <p>{party.name}</p>
        {hasText(party.taxId) && <p className="text-xs font-mono font-medium text-muted-foreground mt-0.5">{party.taxId}</p>}
      </div>
    </div>
  )
}

const hasText = (v?: string | null): v is string => !!v && v.trim().length > 0

export function ManufacturingSpecsPanel({ view, className }: { view: ManufacturingSpecsView; className?: string }) {
  const { product, customer, contact, phases, specifications, designFiles = [] } = view
  const qty = product?.quantity
  const hasQty = qty !== undefined && qty !== null && qty !== "" && Number(qty) > 0

  const stages = [
    { key: "prepress", icon: Paintbrush, label: "Pre-Impresión", on: phases?.prepress, spec: specifications?.prepress },
    { key: "press", icon: Printer, label: "Impresión", on: phases?.press, spec: specifications?.press },
    { key: "postpress", icon: FileText, label: "Post-Impresión", on: phases?.postpress, spec: specifications?.postpress },
  ].filter(s => s.on || hasText(s.spec))

  const hasTech = view.printType || view.designNeeded || view.folioEnabled || designFiles.length > 0
  const isEmpty = !hasTech && stages.length === 0

  return (
    <div className={className}>
      {(product || customer || contact || view.createdAt || view.requestedDelivery) && (
        <Section icon={Layers} title="Información">
          {product && (
            <Row label="Producto">
              <div className="flex items-start gap-2">
                <Package className="h-3.5 w-3.5 mt-px shrink-0 text-muted-foreground/60" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {hasQty && (
                      <span className="font-mono tabular-nums">
                        {qty} {product.uomName ?? "und"} ×{" "}
                      </span>
                    )}
                    {product.name}
                  </p>
                  {hasText(view.productDescription) && (
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground line-clamp-3">{view.productDescription}</p>
                  )}
                </div>
              </div>
            </Row>
          )}
          {customer && (
            <Row label="Cliente">
              <PartyLine party={customer} icon={Building2} />
            </Row>
          )}
          {(view.createdAt || view.requestedDelivery) && (
            <>
              {view.createdAt && <Row label="Fecha de creación" icon={CalendarIcon}><span className="tabular-nums">{formatPlainDate(view.createdAt)}</span></Row>}
              {view.requestedDelivery && <Row label="Entrega solicitada" icon={CalendarCheck}><span className="tabular-nums">{formatPlainDate(view.requestedDelivery)}</span></Row>}
            </>
          )}
          {contact && (
            <Row label="Contacto relacionado">
              <PartyLine party={contact} icon={User} />
            </Row>
          )}
        </Section>
      )}

      <Section icon={Wrench} title="Especificaciones">
        {isEmpty && <p className="text-xs text-muted-foreground">Sin especificaciones registradas</p>}

        {view.printType && <Row label="Tecnología"><span className="inline-flex items-center gap-1.5"><Printer className="h-3 w-3 text-muted-foreground/60" />{PRINT_TYPE_LABEL[view.printType]}</span></Row>}
        {view.designNeeded && <Row label="Diseño">Requerido</Row>}
        {view.folioEnabled && (
          <Row label="Folios" mono>
            <span className="inline-flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground/60" />{hasText(view.folioStart) ? `Desde ${view.folioStart}` : "Numerado"}</span>
          </Row>
        )}
        {designFiles.length > 0 && (
          <Row label={`Archivos de diseño (${designFiles.length})`}>
            <ul className="space-y-1">
              {designFiles.map((name, i) => (
                <li key={`${name}-${i}`} className="flex items-center gap-1.5 min-w-0">
                  <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          </Row>
        )}

        {stages.map(s => (
          <Row key={s.key} label={s.label} icon={s.icon}>
            {hasText(s.spec) ? <span className="whitespace-pre-line">{s.spec}</span> : <span className="font-normal text-muted-foreground">Sin indicaciones adicionales</span>}
          </Row>
        ))}
      </Section>
    </div>
  )
}
