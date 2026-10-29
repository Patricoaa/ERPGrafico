"use client"

import { Package, Truck } from "lucide-react"
import type { ReactNode } from "react"
import { StepEmptyPanel } from "./StepEmptyPanel"

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
export function PlanningEmptyState({ kind, action }: { kind: PlanningEmptyKind; action?: ReactNode }) {
  const { icon, title, description } = COPY[kind]
  return <StepEmptyPanel icon={icon} title={title} description={description} action={action} />
}

export const PLANNING_EMPTY_COPY = COPY
