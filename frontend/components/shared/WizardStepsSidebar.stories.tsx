import type { Meta, StoryObj } from "@storybook/react"
import { WizardStepsSidebar, type WizardSidebarStep } from "./WizardStepsSidebar"
import { Package, Truck, CreditCard, User, FileText, Hammer, Building2, ShoppingCart, Warehouse, CheckCircle2, Eye, Pencil, RotateCcw } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const meta: Meta<typeof WizardStepsSidebar> = {
    title: "Shared/WizardStepsSidebar",
    component: WizardStepsSidebar,
    parameters: {
        layout: "padded",
        backgrounds: { default: "light", values: [{ name: "light", value: "#ffffff" }, { name: "dark", value: "#0f172a" }] },
    },
    argTypes: {
        showNumbers: { control: "boolean" },
        detailVisibility: { control: "select", options: ["both", "active", "past", "none"] },
        showCounter: { control: "boolean" },
        density: { control: "select", options: ["compact", "comfortable"] },
        currentStep: { control: { type: "range", min: 1, max: 13, step: 1 } },
    },
    tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof WizardStepsSidebar>

/** 13-step workorder-style rail with details and governance actions */
export const WorkorderRail: Story = {
    args: {
        title: "Etapas",
        currentStep: 4,
        steps: [
            { id: "origin", label: "Origen de Fabricación", icon: Package, detail: <span>Manual</span>, status: "past" },
            { id: "sale", label: "Selección de OV y Producto", icon: FileText, detail: <span>OV-2024-00123 · Producto A</span>, status: "past" },
            { id: "product", label: "Selección de Producto", icon: Package, detail: <span>Producto B</span>, status: "past" },
            { id: "config", label: "Configurar Fabricación", icon: Hammer, detail: <span>Offset · 4 colores · 500 uds</span>, status: "active" },
            { id: "mat_assign", label: "Asignación de Materiales", icon: Package, detail: <span>12 componentes asignados</span>, status: "future" },
            { id: "mat_approval", label: "Aprobación de Materiales", icon: CheckCircle2, detail: <span>Pendiente: 3 sin stock</span>, status: "future" },
            { id: "outsourcing_assign", label: "Asignación Tercerizados", icon: Truck, detail: <span>2 servicios</span>, status: "future" },
            { id: "prepress", label: "Pre-Impresión", icon: FileText, status: "future" },
            { id: "press", label: "Impresión", icon: Hammer, status: "future" },
            { id: "postpress", label: "Post-Impresión", icon: Package, status: "future" },
            { id: "outsourcing_verify", label: "Verificación Tercerizados", icon: Truck, status: "future" },
            { id: "rectification", label: "Rectificación", icon: RotateCcw, status: "future" },
            { id: "finished", label: "Finalizado", icon: CheckCircle2, status: "future" },
        ],
        showNumbers: true,
        detailVisibility: "both",
        showCounter: true,
        density: "compact",
    },
}

/** Sales checkout rail — 5 steps, detail only on active/past */
export const SalesCheckoutRail: Story = {
    args: {
        title: "Proceso de Venta",
        currentStep: 3,
        steps: [
            { id: "customer", label: "Cliente", icon: User, detail: <span>Imprenta San Martín SPA</span>, status: "past" },
            { id: "dte", label: "Documento", icon: FileText, detail: <span>Factura Electrónica</span>, status: "past" },
            { id: "manufacturing", label: "Fabricación", icon: Hammer, detail: <span>Configurada · Offset 4 colores</span>, status: "active" },
            { id: "delivery", label: "Entrega", icon: Truck, detail: <div className="space-y-0.5"><span>Entrega Programada</span><span className="text-3xs text-muted-foreground">15/01/2025</span></div>, status: "future" },
            { id: "payment", label: "Pago", icon: CreditCard, detail: <div className="space-y-0.5"><span>Transferencia</span><span className="font-bold">$ 1.250.000</span></div>, status: "future" },
        ],
        showNumbers: true,
        detailVisibility: "both",
        showCounter: true,
        density: "compact",
    },
}

/** Notes wizard rail — with badge on current step */
export const NotesWizardRail: Story = {
    args: {
        title: "Proceso Nota Crédito",
        currentStep: 2,
        steps: [
            { id: "items", label: "Productos", icon: Package, detail: <span>5 productos seleccionados</span>, status: "past" },
            { id: "manufacturing", label: "Producción", icon: Hammer, detail: <span>Producción configurada</span>, status: "active", badge: <span className="bg-primary/10 text-primary text-3xs px-1.5 py-0.5 rounded border border-primary/20">actual</span> },
            { id: "logistics", label: "Logística", icon: Truck, detail: <span>Movimiento registrado</span>, status: "future" },
            { id: "dte", label: "Documento", icon: FileText, detail: <span>Folio: NC-2024-0045</span>, status: "future" },
            { id: "payment", label: "Pago", icon: CreditCard, detail: <div className="space-y-0.5"><span>Transferencia</span><span className="font-bold">$ 450.000</span></div>, status: "future" },
        ],
        showNumbers: true,
        detailVisibility: "both",
        showCounter: true,
        density: "compact",
    },
}

/** Purchase checkout rail — sliced by totalSteps */
export const PurchaseCheckoutRail: Story = {
    args: {
        title: "Proceso de Compra",
        currentStep: 3,
        steps: [
            { id: 1, label: "Proveedor", icon: Building2, detail: <span>Papeles del Sur Ltda.</span>, status: "past" },
            { id: 2, label: "Productos", icon: ShoppingCart, status: "past" },
            { id: 3, label: "Documento", icon: FileText, detail: <span>Factura de Compra Electrónica</span>, status: "active" },
            { id: 4, label: "Recepción", icon: Package, detail: <div className="space-y-1"><span>Recepción Inmediata (Bodega)</span><div className="flex items-center gap-1.5 mt-1"><Warehouse className="h-3 w-3" /><span className="text-3xs font-semibold">Bodega Central</span></div></div>, status: "future" },
            { id: 5, label: "Pago", icon: CreditCard, detail: <div className="space-y-0.5"><span>Crédito 30 días</span><span className="font-bold">$ 2.100.000</span></div>, status: "future" },
        ],
        showNumbers: true,
        detailVisibility: "both",
        showCounter: true,
        density: "compact",
    },
}

/** Interactive rail with governance actions (view/edit/rewind) on hover */
export const WithGovernanceActions: Story = {
    args: {
        title: "Etapas",
        currentStep: 3,
        steps: [
            { id: "a", label: "Paso 1 — Completado", icon: Package, status: "past" },
            { id: "b", label: "Paso 2 — En curso", icon: Truck, status: "current" },
            { id: "c", label: "Paso 3 — Editando", icon: CreditCard, status: "active" },
            { id: "d", label: "Paso 4 — Pendiente", icon: User, status: "future" },
        ],
        showNumbers: true,
        detailVisibility: "both",
        showCounter: true,
        density: "compact",
        renderStepActions: (step, index) => {
            const isActive = index === 2
            const isPast = index < 2
            const isCurrent = index === 1

            if (isActive) return <div className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" title="Editando" />
            if (isCurrent) return <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" title="Etapa actual" />

            if (isPast) {
                return (
                    <TooltipProvider>
                        <div className="flex items-center gap-0.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success transition-opacity group-hover:opacity-0 group-hover:w-0 group-hover:overflow-hidden" />
                            <div className="hidden group-hover:flex items-center gap-0.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" className="p-1 rounded hover:bg-accent h-auto w-auto" aria-label="Ver">
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Ver</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" className="p-1 rounded hover:bg-accent h-auto w-auto" aria-label="Editar">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" className="p-1 rounded hover:bg-accent h-auto w-auto" aria-label="Retroceder">
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Retroceder</TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </TooltipProvider>
                )
            }
            return null
        },
    },
}

/** Comfortable density variant */
export const ComfortableDensity: Story = {
    args: {
        title: "Proceso (comfortable)",
        currentStep: 2,
        steps: [
            { id: "a", label: "Paso Uno", icon: Package, detail: <span>Detalle amplio</span>, status: "past" },
            { id: "b", label: "Paso Dos", icon: Truck, detail: <span>Más espacio vertical</span>, status: "active" },
            { id: "c", label: "Paso Tres", icon: CreditCard, status: "future" },
        ],
        density: "comfortable",
        showNumbers: true,
        detailVisibility: "both",
    },
}

/** Without numbers — icons only */
export const IconsOnly: Story = {
    args: {
        title: "Proceso",
        currentStep: 2,
        steps: [
            { id: "a", label: "Productos", icon: Package, status: "past" },
            { id: "b", label: "Logística", icon: Truck, status: "active" },
            { id: "c", label: "Pago", icon: CreditCard, status: "future" },
        ],
        showNumbers: false,
        detailVisibility: "none",
        showCounter: true,
    },
}