"use client"

import React from "react"
import dynamic from "next/dynamic"
import { SkeletonShell } from "@/components/shared"

/**
 * Standard props every entity drawer receives from the global opener.
 * Per-entity adapters in ENTITY_DRAWERS map these to component-specific shapes.
 */
export interface EntityDrawerProps {
    id: number
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Optional pre-fetched data to avoid round-trip when caller already has it */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
    onSuccess?: () => void
}

const skeleton = (label: string) => <SkeletonShell isLoading={true} ariaLabel={`Cargando ${label}`} />

const ContactDrawer = dynamic(() => import("@/features/contacts/components/ContactDrawer"), {
    ssr: false,
    loading: () => skeleton("contacto"),
})

const TreasuryAccountDrawer = dynamic(
    () => import("@/features/treasury/components/TreasuryAccountDrawer").then((m) => m.TreasuryAccountDrawer),
    { ssr: false, loading: () => skeleton("cuenta de tesorería") }
)

const WorkOrderWizard = dynamic(
    () => import("@/features/production").then((m) => m.WorkOrderWizard),
    { ssr: false, loading: () => skeleton("orden de trabajo") }
)

const JournalEntryDrawer = dynamic(
    () => import("@/features/accounting").then((m) => m.JournalEntryDrawer),
    { ssr: false, loading: () => skeleton("asiento contable") }
)

const ProductDrawer = dynamic(
    () => import("@/features/inventory").then((m) => m.ProductDrawer),
    { ssr: false, loading: () => skeleton("producto") }
)

const CategoryDrawer = dynamic(
    () => import("@/features/inventory").then((m) => m.CategoryDrawer),
    { ssr: false, loading: () => skeleton("categoría") }
)

const WarehouseDrawer = dynamic(
    () => import("@/features/inventory").then((m) => m.WarehouseDrawer),
    { ssr: false, loading: () => skeleton("bodega") }
)

const UoMDrawer = dynamic(
    () => import("@/features/inventory").then((m) => m.UoMDrawer),
    { ssr: false, loading: () => skeleton("unidad de medida") }
)

const EmployeeDrawer = dynamic(
    () => import("@/features/hr").then((m) => m.EmployeeDrawer),
    { ssr: false, loading: () => skeleton("empleado") }
)

const PricingRuleDrawer = dynamic(
    () => import("@/features/sales").then((m) => m.PricingRuleDrawer),
    { ssr: false, loading: () => skeleton("regla de precio") }
)

const AccountDrawer = dynamic(
    () => import("@/features/finance").then((m) => m.AccountDrawer),
    { ssr: false, loading: () => skeleton("cuenta contable") }
)

const PayrollDetailDrawer = dynamic(
    () => import("@/features/hr").then((m) => m.PayrollDetailDrawer),
    { ssr: false, loading: () => skeleton("liquidación") }
)

const UserDrawer = dynamic(
    () => import("@/features/users").then((m) => m.UserDrawer),
    { ssr: false, loading: () => skeleton("usuario") }
)

const PosTerminalDrawer = dynamic(
    () => import("@/features/sales").then((m) => m.PosTerminalDrawer),
    { ssr: false, loading: () => skeleton("caja") }
)

const ProviderDrawer = dynamic(
    () => import("@/features/treasury").then((m) => m.ProviderDrawer),
    { ssr: false, loading: () => skeleton("proveedor de pago") }
)

const SalesOrdersDrawer = dynamic(
    () => import("@/features/pos").then((m) => m.SalesOrdersDrawer),
    { ssr: false, loading: () => skeleton("sesión POS") }
)

const AbsenceDrawer = dynamic(
    () => import("@/features/hr").then((m) => m.AbsenceDrawer),
    { ssr: false, loading: () => skeleton("inasistencia") }
)

const AdvanceDrawer = dynamic(
    () => import("@/features/hr").then((m) => m.AdvanceDrawer),
    { ssr: false, loading: () => skeleton("anticipo") }
)

const DeviceDrawer = dynamic(
    () => import("@/features/treasury").then((m) => m.DeviceDrawer),
    { ssr: false, loading: () => skeleton("dispositivo") }
)

const BankJournalDrawer = dynamic(
    () => import("@/features/finance").then((m) => m.BankJournalDrawer),
    { ssr: false, loading: () => skeleton("diario banco") }
)

const PaymentDrawer = dynamic(
    () => import("@/features/finance").then((m) => m.PaymentDrawer),
    { ssr: false, loading: () => skeleton("pago") }
)

const SaleOrderDrawer = dynamic(
    () => import("@/features/sales/components/SaleOrderDrawer").then((m) => m.SaleOrderDrawer),
    { ssr: false, loading: () => skeleton("nota de venta") }
)

const PurchaseOrderDrawer = dynamic(
    () => import("@/features/purchasing/components/PurchaseOrderDrawer").then((m) => m.PurchaseOrderDrawer),
    { ssr: false, loading: () => skeleton("orden de compra") }
)

const InvoiceDrawer = dynamic(
    () => import("@/features/billing/components/InvoiceDrawer").then((m) => m.InvoiceDrawer),
    { ssr: false, loading: () => skeleton("factura") }
)

const SaleDeliveryDrawer = dynamic(
    () => import("@/features/sales/components/SaleDeliveryDrawer").then((m) => m.SaleDeliveryDrawer),
    { ssr: false, loading: () => skeleton("despacho") }
)

const CashMovementDrawer = dynamic(
    () => import("@/features/treasury/components/CashMovementDrawer").then((m) => m.CashMovementDrawer),
    { ssr: false, loading: () => skeleton("movimiento de tesorería") }
)

const TerminalBatchDrawer = dynamic(
    () => import("@/features/treasury/components/TerminalBatchDrawer").then((m) => m.TerminalBatchDrawer),
    { ssr: false, loading: () => skeleton("lote de terminal") }
)

const ProfitDistributionDrawer = dynamic(
    () => import("@/features/settings/components/ProfitDistributionDrawer").then((m) => m.ProfitDistributionDrawer),
    { ssr: false, loading: () => skeleton("distribución de resultados") }
)

const StockMoveDrawer = dynamic(
    () => import("@/features/inventory/components/StockMoveDrawer").then((m) => m.StockMoveDrawer),
    { ssr: false, loading: () => skeleton("movimiento de stock") }
)

const GroupDrawer = dynamic(
    () => import("@/features/users").then((m) => m.GroupDrawer),
    { ssr: false, loading: () => skeleton("grupo") }
)

const PurchaseReceiptDrawer = dynamic(
    () => import("@/features/purchasing/components/PurchaseReceiptDrawer").then((m) => m.PurchaseReceiptDrawer),
    { ssr: false, loading: () => skeleton("recepción de compra") }
)

const PurchaseReturnDrawer = dynamic(
    () => import("@/features/purchasing/components/PurchaseReturnDrawer").then((m) => m.PurchaseReturnDrawer),
    { ssr: false, loading: () => skeleton("devolución de compra") }
)

const BankStatementDrawer = dynamic(
    () => import("@/features/treasury/components/BankStatementDrawer").then((m) => m.BankStatementDrawer),
    { ssr: false, loading: () => skeleton("cartola bancaria") }
)

const F29DeclarationDrawer = dynamic(
    () => import("@/features/tax/components/F29DeclarationDrawer").then((m) => m.F29DeclarationDrawer),
    { ssr: false, loading: () => skeleton("declaración F29") }
)

const AccountingPeriodDrawer = dynamic(
    () => import("@/features/tax/components/AccountingPeriodDrawer").then((m) => m.AccountingPeriodDrawer),
    { ssr: false, loading: () => skeleton("período contable") }
)

/**
 * Per-entity drawer renderers. Keyed by entity registry label.
 * Add a new entry here when you want an entity to open in-context
 * instead of navigating to its detail page.
 *
 * The corresponding entry in ENTITY_REGISTRY must also set `hasDrawer: true`.
 *
 * Drawers marked with (*) require full entity data via the `data` prop.
 * EntityBadge always satisfies this automatically (it passes the table row data).
 * For programmatic openEntity() calls without data, the form opens with minimal state.
 */
export const ENTITY_DRAWERS: Record<string, (props: EntityDrawerProps) => React.ReactNode> = {
    // ── Contacts ──────────────────────────────────────────────────────────────
    "contacts.contact": ({ id, open, onOpenChange, data, onSuccess }) => (
        <ContactDrawer
            open={open}
            onOpenChange={onOpenChange}
            contact={data ?? { id }}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Treasury ──────────────────────────────────────────────────────────────
    "treasury.treasuryaccount": ({ id, open, onOpenChange, data, onSuccess }) => (
        <TreasuryAccountDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            accountId={id}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Production ────────────────────────────────────────────────────────────
    "production.workorder": ({ id, open, onOpenChange }) => (
        <WorkOrderWizard
            mode={{ kind: "manage", orderId: id }}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),

    // ── Accounting ────────────────────────────────────────────────────────────
    // * requires full entry data (lines, items) — EntityBadge always provides it
    "accounting.journalentry": ({ open, onOpenChange, data, onSuccess }) => (
        <JournalEntryDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Inventory ─────────────────────────────────────────────────────────────
    // * requires full product data — EntityBadge always provides it
    "inventory.product": ({ open, onOpenChange, data, onSuccess }) => (
        <ProductDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),
    // * requires full category data — EntityBadge always provides it
    "inventory.category": ({ open, onOpenChange, data, onSuccess }) => (
        <CategoryDrawer
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),
    // * requires full warehouse data — EntityBadge always provides it
    "inventory.warehouse": ({ open, onOpenChange, data, onSuccess }) => (
        <WarehouseDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),
    // * requires full UoM data — EntityBadge always provides it
    "inventory.uom": ({ open, onOpenChange, data, onSuccess }) => (
        <UoMDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),
    // * requires full pricing rule data — EntityBadge always provides it
    "inventory.pricingrule": ({ open, onOpenChange, data, onSuccess }) => (
        <PricingRuleDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── HR ────────────────────────────────────────────────────────────────────
    // * requires full employee data — EntityBadge always provides it
    "hr.employee": ({ open, onOpenChange, data, onSuccess }) => (
        <EmployeeDrawer
            open={open}
            onOpenChange={onOpenChange}
            employee={data ?? null}
            onSaved={() => onSuccess?.()}
        />
    ),
    "hr.payroll": ({ id, open, onOpenChange, onSuccess }) => (
        <PayrollDetailDrawer
            open={open}
            onOpenChange={onOpenChange}
            payrollId={id}
            onUpdate={() => onSuccess?.()}
        />
    ),

    // ── Accounting ────────────────────────────────────────────────────────────
    // * requires full account data — EntityBadge always provides it
    "accounting.account": ({ open, onOpenChange, data, onSuccess }) => (
        <AccountDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Users ─────────────────────────────────────────────────────────────────
    // * requires full user data — EntityBadge always provides it
    "core.user": ({ open, onOpenChange, data, onSuccess }) => (
        <UserDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Treasury hardware ─────────────────────────────────────────────────────
    // * requires full terminal/provider data — EntityBadge always provides it
    "treasury.terminal": ({ open, onOpenChange, data, onSuccess }) => (
        <PosTerminalDrawer
            open={open}
            onOpenChange={onOpenChange}
            terminal={data ?? null}
            onSuccess={() => onSuccess?.()}
        />
    ),
    "treasury.terminalprovider": ({ open, onOpenChange, data, onSuccess }) => (
        <ProviderDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            provider={data ?? null}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── POS ───────────────────────────────────────────────────────────────────
    "pos.session": ({ id, open, onOpenChange }) => (
        <SalesOrdersDrawer
            open={open}
            onOpenChange={onOpenChange}
            posSessionId={id}
        />
    ),

    // ── HR extended ───────────────────────────────────────────────────────────
    // * requires full absence data — EntityBadge always provides it
    "hr.absence": ({ open, onOpenChange, data, onSuccess }) => (
        <AbsenceDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            absence={data ?? null}
            onSaved={() => onSuccess?.()}
        />
    ),
    // * requires full advance data — EntityBadge always provides it
    "hr.salaryadvance": ({ open, onOpenChange, data, onSuccess }) => (
        <AdvanceDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            advance={data ?? null}
            onSaved={() => onSuccess?.()}
        />
    ),

    // ── Treasury hardware extended ────────────────────────────────────────────
    // * requires full device data — EntityBadge always provides it
    "treasury.terminaldevice": ({ open, onOpenChange, data, onSuccess }) => (
        <DeviceDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            device={data ?? null}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Finance ───────────────────────────────────────────────────────────────
    // * requires full bank journal data — EntityBadge always provides it
    "finance.bankjournal": ({ open, onOpenChange, data, onSuccess }) => (
        <BankJournalDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),
    // * requires full payment data — EntityBadge always provides it
    "finance.payment": ({ open, onOpenChange, data, onSuccess }) => (
        <PaymentDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Users ─────────────────────────────────────────────────────────────────
    // * requires full group data — EntityBadge always provides it
    "users.group": ({ open, onOpenChange, data, onSuccess }) => (
        <GroupDrawer
            mode={data ? 'view' : 'create'}
            open={open}
            onOpenChange={onOpenChange}
            initialData={data}
            onSuccess={() => onSuccess?.()}
        />
    ),

    // ── Purchasing (read-only detail drawers) ────────────────────────────────
    "purchasing.purchasereceipt": ({ id, open, onOpenChange }) => (
        <PurchaseReceiptDrawer
            receiptId={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "purchasing.purchasereturn": ({ id, open, onOpenChange }) => (
        <PurchaseReturnDrawer
            returnId={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),

    // ── Treasury (read-only detail drawers) ──────────────────────────────────
    "treasury.bankstatement": ({ id, open, onOpenChange }) => (
        <BankStatementDrawer
            statementId={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),

    // ── Tax (read-only detail drawers) ───────────────────────────────────────
    "tax.f29declaration": ({ id, open, onOpenChange }) => (
        <F29DeclarationDrawer
            declarationId={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "tax.accountingperiod": ({ id, open, onOpenChange }) => (
        <AccountingPeriodDrawer
            periodId={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),

    // ── Transaction Drawers (Phase 2 — dual-mode view/edit) ─────────────────
    "sales.saleorder": ({ id, open, onOpenChange }) => (
        <SaleOrderDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "purchasing.purchaseorder": ({ id, open, onOpenChange }) => (
        <PurchaseOrderDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "billing.invoice": ({ id, open, onOpenChange }) => (
        <InvoiceDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "sales.saledelivery": ({ id, open, onOpenChange, data }) => (
        <SaleDeliveryDrawer
            id={id}
            saleOrderId={data?.sale_order}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "treasury.treasurymovement": ({ id, open, onOpenChange }) => (
        <CashMovementDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "treasury.terminalbatch": ({ id, open, onOpenChange }) => (
        <TerminalBatchDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "contacts.profitdistributionresolution": ({ id, open, onOpenChange }) => (
        <ProfitDistributionDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
    "inventory.stockmove": ({ id, open, onOpenChange }) => (
        <StockMoveDrawer
            id={id}
            open={open}
            onOpenChange={onOpenChange}
        />
    ),
}

export function hasEntityDrawer(label: string | undefined | null): boolean {
    return !!label && label in ENTITY_DRAWERS
}
