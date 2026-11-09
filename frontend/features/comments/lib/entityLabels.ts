import type { ComponentProps } from "react"
import type { ActivitySidebar } from "@/features/audit"

export type AuditEntityType = ComponentProps<typeof ActivitySidebar>["entityType"]

/**
 * Clave de historial (snake_case legado de ActivitySidebar) → label "app.model" del
 * modelo comentable (ADR-0111). Verificado contra `apps.get_model`. Las claves sin
 * modelo propio (bank_journal, reordering_rule, company_settings, attachment) no
 * tienen comentarios.
 */
export const COMMENT_LABEL_BY_AUDIT_TYPE: Partial<Record<AuditEntityType, string>> = {
    product: "inventory.product",
    contact: "contacts.contact",
    sale_order: "sales.saleorder",
    purchase_order: "purchasing.purchaseorder",
    invoice: "billing.invoice",
    payment: "treasury.treasurymovement",
    sale_delivery: "sales.saledelivery",
    sale_return: "sales.salereturn",
    purchase_receipt: "purchasing.purchasereceipt",
    purchase_return: "purchasing.purchasereturn",
    inventory_document: "inventory.inventorydocument",
    check: "treasury.check",
    terminal_batch: "treasury.terminalbatch",
    profit_distribution: "contacts.profitdistributionresolution",
    user: "core.user",
    work_order: "production.workorder",
    journal_entry: "accounting.journalentry",
    stock_move: "inventory.stockmove",
    pricing_rule: "inventory.pricingrule",
    treasuryaccount: "treasury.treasuryaccount",
    bank: "treasury.bank",
    paymentmethod: "treasury.paymentmethod",
    terminal: "treasury.posterminal",
    category: "inventory.productcategory",
    warehouse: "inventory.warehouse",
    uom: "inventory.uom",
    uom_category: "inventory.uomcategory",
    attribute: "inventory.productattribute",
    account: "accounting.account",
    employee: "hr.employee",
    salaryadvance: "hr.salaryadvance",
    absence: "hr.absence",
    fiscal_year: "accounting.fiscalyear",
    tax_period: "tax.taxperiod",
    f29_declaration: "tax.f29declaration",
    task: "workflow.task",
    group: "auth.group",
    inventory_count: "inventory.inventorycount",
    bank_loan: "treasury.bankloan",
    bankstatement: "treasury.bankstatement",
    payroll: "hr.payroll",
    budget: "accounting.budget",
    accounting_period: "tax.accountingperiod",
}
