"use client"

import { Package, Truck } from "lucide-react"
import { EmptyState } from "@/components/shared"

const COPY = {
  materials: {
    icon: Package,
    title: "Sin materiales asignados",
    description: "Agrega los materiales de stock que consumirá esta fabricación.",
  },
  outsourcing: {
    icon: Truck,
    title: "Sin servicios tercerizados",
    description: "Agrega los servicios que se encargarán a proveedores externos.",
  },
} as const

export type PlanningEmptyKind = keyof typeof COPY

/** Shared empty state for wizard steps 4/5 and their POS draft counterparts. */
export function PlanningEmptyState({ kind }: { kind: PlanningEmptyKind }) {
  const { icon, title, description } = COPY[kind]
  return <EmptyState context="production" variant="compact" icon={icon} title={title} description={description} />
}

export const PLANNING_EMPTY_COPY = COPY
