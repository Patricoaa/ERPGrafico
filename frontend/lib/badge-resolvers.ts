/**
 * badge-resolvers.ts
 *
 * Single source of truth for all badge business logic.
 * Resolvers are pure functions: domain data in → badge props out.
 * No JSX, no styles, no side effects.
 *
 * Consumers: StatusBadge, EntityBadge, DataCell.Entity
 * Contract: docs/20-contracts/component-badge.md
 */

import { getEntityMetadata, formatEntityDisplay } from '@/lib/entity-registry'
import type { LucideIcon } from 'lucide-react'

// ─── Intent type ──────────────────────────────────────────────────────────────

export type BadgeIntent =
    | 'neutral'
    | 'info'
    | 'success'
    | 'warning'
    | 'destructive'
    | 'primary'

// ─── Status resolver ──────────────────────────────────────────────────────────

interface StatusStyle {
    label: string
    intent: BadgeIntent
}

/**
 * STATUS_MAP — canonical mapping of business status strings to visual intent + label.
 * The single authoritative source replacing all local getStatusColor/getStatusVariant helpers.
 *
 * To add a new status: add one entry here. Do NOT add local helpers in feature components.
 */
export const STATUS_MAP: Record<string, StatusStyle> = {
    // ── Lifecycle & Documents ────────────────────────────────────────────
    DRAFT:          { label: 'Borrador',     intent: 'info' },
    CONFIRMED:      { label: 'Confirmado',   intent: 'warning' },
    PAID:           { label: 'Pagado',       intent: 'success' },
    CANCELLED:      { label: 'Cancelado',    intent: 'destructive' },
    VOIDED:         { label: 'Anulado',      intent: 'destructive' },
    POSTED:         { label: 'Publicado',    intent: 'success' },

    // ── Progress / Logistics ─────────────────────────────────────────────
    PARTIAL:        { label: 'Parcial',      intent: 'warning' },
    DELIVERED:      { label: 'Entregado',    intent: 'success' },
    SENT:           { label: 'Enviado',      intent: 'info' },
    RECEIVED:       { label: 'Recibido',     intent: 'success' },

    // ── Production ────────────────────────────────────────────────────────
    IN_PROGRESS:    { label: 'En Proceso',   intent: 'warning' },
    FINISHED:       { label: 'Finalizado',   intent: 'success' },
    MANUFACTURING:  { label: 'Fabricando',   intent: 'primary' },

    // ── Financial / Treasury / Reconciliation ─────────────────────────────
    COMPLETED:      { label: 'Completado',   intent: 'success' },
    UNRECONCILED:   { label: 'Sin Conciliar',intent: 'info' },
    MATCHED:        { label: 'Sugerido',     intent: 'info' },
    RECONCILED:     { label: 'Conciliado',   intent: 'success' },
    DISPUTED:       { label: 'Disputado',    intent: 'destructive' },
    EXCLUDED:       { label: 'Excluido',     intent: 'neutral' },
    OPEN:           { label: 'Abierto',      intent: 'success' },
    CLOSED:         { label: 'Cerrado',      intent: 'info' },
    CLOSING:        { label: 'En Cierre',    intent: 'warning' },
    UNDER_REVIEW:   { label: 'En Revisión',  intent: 'warning' },
    SETTLED:        { label: 'Liquidado',    intent: 'success' },
    INVOICED:       { label: 'Facturado',    intent: 'info' },
    PENDING:        { label: 'Pendiente',    intent: 'warning' },

    // ── Semantic universals ───────────────────────────────────────────────
    SUCCESS:        { label: 'Completado',   intent: 'success' },
    INFO:           { label: 'Info',         intent: 'info' },
    WARNING:        { label: 'Advertencia',  intent: 'warning' },
    ERROR:          { label: 'Error',        intent: 'destructive' },
    DESTRUCTIVE:    { label: 'Eliminado',    intent: 'destructive' },
    NEUTRAL:        { label: 'Pendiente',    intent: 'neutral' },
    NOT_APPLICABLE: { label: 'No aplica',    intent: 'neutral' },

    // ── Accounting — Account Types ────────────────────────────────────────
    ASSET:          { label: 'Activo',       intent: 'info' },
    LIABILITY:      { label: 'Pasivo',       intent: 'warning' },
    EQUITY:         { label: 'Patrimonio',   intent: 'neutral' },
    INCOME:         { label: 'Ingreso',      intent: 'success' },
    EXPENSE:        { label: 'Gasto',        intent: 'destructive' },

    // ── Credit / Risk ─────────────────────────────────────────────────────
    RISK_LOW:       { label: 'Riesgo Bajo',  intent: 'success' },
    RISK_MEDIUM:    { label: 'Riesgo Medio', intent: 'warning' },
    RISK_HIGH:      { label: 'Riesgo Alto',  intent: 'warning' },
    RISK_CRITICAL:  { label: 'Riesgo Crítico', intent: 'destructive' },

    ORIGIN_MANUAL:           { label: 'Manual',    intent: 'info' },
    ORIGIN_FALLBACK:         { label: 'Fallback',  intent: 'warning' },
    ORIGIN_CREDIT_PORTFOLIO: { label: 'Cartera',   intent: 'success' },

    WRITTEN_OFF:   { label: 'Castigado',  intent: 'destructive' },
    WRITE_OFF:     { label: 'Castigado',  intent: 'destructive' },
    CURRENT:       { label: 'Vigente',    intent: 'success' },
    OVERDUE_30:    { label: '1-30 Días',  intent: 'warning' },
    OVERDUE_60:    { label: '31-60 Días', intent: 'warning' },
    OVERDUE_90:    { label: '61-90 Días', intent: 'destructive' },
    OVERDUE_90PLUS:{ label: '+90 Días',   intent: 'destructive' },

    // ── HR ────────────────────────────────────────────────────────────────
    AUSENTISMO:        { label: 'Ausentismo',     intent: 'destructive' },
    LICENCIA:          { label: 'Licencia',        intent: 'info' },
    PERMISO_SIN_GOCE:  { label: 'Permiso s/Goce', intent: 'warning' },
    AUSENCIA_HORAS:    { label: 'Horas',           intent: 'neutral' },
    DISCOUNTED:        { label: 'Descontado',      intent: 'success' },

    // ── Contact Types ─────────────────────────────────────────────────────
    CUSTOMER: { label: 'Cliente',    intent: 'info' },
    SUPPLIER: { label: 'Proveedor',  intent: 'primary' },
    BOTH:     { label: 'Ambos',      intent: 'success' },
    RELATED:  { label: 'Relacionado',intent: 'warning' },

    // ── Lowercase fallbacks (legacy support) ──────────────────────────────
    active:   { label: 'Activo',   intent: 'primary' },
    inactive: { label: 'Inactivo', intent: 'neutral' },
}

export interface ResolvedStatus {
    intent: BadgeIntent
    label: string
}

/**
 * resolveStatus — translates a business status string into badge props.
 * Case-insensitive. Falls back to neutral intent + raw status string.
 *
 * Usage:
 *   const { intent, label } = resolveStatus('PAID')
 *   // → { intent: 'success', label: 'Pagado' }
 */
export function resolveStatus(status: string | null | undefined): ResolvedStatus {
    if (!status) return { intent: 'neutral', label: '' }

    const upper = status.toUpperCase()
    const match = STATUS_MAP[upper] ?? STATUS_MAP[status]

    return match
        ? { intent: match.intent, label: match.label }
        : { intent: 'neutral', label: status }
}

// ─── Entity resolver ──────────────────────────────────────────────────────────

export interface ResolvedEntity {
    displayCode: string
    icon: LucideIcon | null
    href: string | undefined
}

/**
 * resolveEntity — translates entity registry label + data into badge props.
 * Reads ENTITY_REGISTRY for icon, display format, and detail URL.
 */
export function resolveEntity(label: string, data: Record<string, unknown>): ResolvedEntity {
    const metadata = getEntityMetadata(label)
    const displayCode = formatEntityDisplay(label, data)
    const href = metadata?.detailUrlPattern?.replace('{id}', String(data?.id ?? ''))

    return {
        displayCode,
        icon: (metadata?.icon as LucideIcon | null) ?? null,
        href,
    }
}

// ----------------------------------------------------------------------
// CATEGORY & ENUM MAPPINGS (for Chip.Category)
// ----------------------------------------------------------------------

export type CategoryDomain = 'product_type' | 'tax_type' | 'transaction_type' | 'dte_type' | 'contact_type'

const CATEGORY_MAP: Record<CategoryDomain, Record<string, { intent: BadgeIntent; label: string }>> = {
    product_type: {
        'STORABLE': { intent: 'info', label: 'Almacenable' },
        'CONSUMABLE': { intent: 'warning', label: 'Consumible' },
        'MANUFACTURABLE': { intent: 'success', label: 'Fabricable' },
        'SERVICE': { intent: 'primary', label: 'Servicio' },
        'SUBSCRIPTION': { intent: 'destructive', label: 'Suscripción' },
    },
    tax_type: {
        'EXEMPT': { intent: 'success', label: 'Exento' },
        'IVA': { intent: 'info', label: 'IVA' },
        'RETENTION': { intent: 'warning', label: 'Retención' },
    },
    transaction_type: {
        'PAYMENT': { intent: 'success', label: 'Pago' },
        'REFUND': { intent: 'destructive', label: 'Reembolso' },
        'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    },
    contact_type: {
        'CUSTOMER': { intent: 'info', label: 'Cliente' },
        'SUPPLIER': { intent: 'primary', label: 'Proveedor' },
        'BOTH':     { intent: 'success', label: 'Ambos' },
        'RELATED':  { intent: 'warning', label: 'Relacionado' },
        'OTHER':    { intent: 'neutral', label: 'Otro' },
    },
    dte_type: {
        // Fallback for strings from backend
    }
}

export function resolveCategory(domain: CategoryDomain, value: string): { intent: BadgeIntent; label: string } {
    const map = CATEGORY_MAP[domain]
    const upperValue = value?.toUpperCase() || ''
    
    if (map && map[upperValue]) {
        return map[upperValue]
    }

    return {
        intent: domain === 'dte_type' ? 'primary' : 'neutral',
        label: value || 'Desconocido'
    }
}
