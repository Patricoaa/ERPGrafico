import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { BarChart3, Boxes, Factory, Landmark, Receipt, ShoppingCart, Users, Wallet } from "lucide-react"
import { ModuleGrid } from "./ModuleGrid"

const meta = {
    title: "Shared/ModuleGrid",
    component: ModuleGrid,
} satisfies Meta<typeof ModuleGrid>
export default meta
type Story = StoryObj<typeof meta>

/** Role `nav`: one 8px row per module — lead, title, one-line description, chevron. */
export const Modules: Story = {
    args: {
        items: [
            { id: "sales", label: "Ventas", description: "Cotizaciones, pedidos y notas de venta", url: "#", icon: ShoppingCart },
            { id: "purchasing", label: "Compras", description: "Órdenes de compra y recepciones", url: "#", icon: Receipt },
            { id: "production", label: "Producción", description: "Órdenes de trabajo, rutas y máquinas", url: "#", icon: Factory },
            { id: "inventory", label: "Inventario", description: "Productos, bodegas y movimientos", url: "#", icon: Boxes },
            { id: "contacts", label: "Contactos", description: "Clientes y proveedores", url: "#", icon: Users },
            { id: "treasury", label: "Tesorería", description: "Bancos, cheques y conciliación bancaria con una descripción deliberadamente larga", url: "#", icon: Wallet },
            { id: "accounting", label: "Contabilidad", url: "#", icon: Landmark },
            { id: "finances", label: "Finanzas", description: "Presupuestos e indicadores", url: "#", icon: BarChart3 },
        ],
    },
    render: (args) => (
        <div className="w-[64rem] p-4">
            <ModuleGrid {...args} />
        </div>
    ),
}
