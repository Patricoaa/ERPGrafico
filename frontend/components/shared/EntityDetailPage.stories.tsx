import type { Meta, StoryObj } from '@storybook/react';
import { EntityDetailPage } from './EntityDetailPage';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'Shared/EntityDetailPage',
  component: EntityDetailPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    readonly: { control: 'boolean' },
  },
} satisfies Meta<typeof EntityDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock form content to simulate a real entity form
const MockForm = () => (
  <div className="flex flex-col gap-6 max-w-2xl">
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-medium">Información General</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Cliente</label>
          <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground flex items-center">
            Empresa ABC Ltda.
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Fecha</label>
          <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground flex items-center">
            2026-05-08
          </div>
        </div>
      </div>
      <div className="space-y-2 mt-4">
        <label className="text-sm font-medium">Observaciones</label>
        <div className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
          Prioridad alta, despachar en la mañana.
        </div>
      </div>
    </div>
  </div>
);

// Mock read-only content
const MockDetailView = () => (
  <div className="flex flex-col gap-6 max-w-2xl">
    <h3 className="text-lg font-medium">Detalle del Movimiento</h3>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
      <div className="space-y-1">
        <dt className="text-muted-foreground font-medium">Referencia</dt>
        <dd className="font-semibold text-foreground">WH-IN-0042</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground font-medium">Fecha</dt>
        <dd className="font-medium text-foreground">2026-05-08 14:30</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground font-medium">Origen</dt>
        <dd className="font-medium text-foreground">Proveedores</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground font-medium">Destino</dt>
        <dd className="font-medium text-foreground">Bodega Principal</dd>
      </div>
    </dl>
  </div>
);

// 1. Edit mode (with instanceId to trigger auto ActivitySidebar)
export const EditMode: Story = {
  args: {
    entityType: 'sale_order',
    title: 'Nota de Venta',
    displayId: 'NV-1042',
    icon: 'receipt-text',
    breadcrumb: [
      { label: 'Ventas', href: '#' },
      { label: 'Órdenes', href: '#' },
    ],
    instanceId: 42, // triggers ActivitySidebar
    children: <MockForm />,
    footer: (
      <>
        <Button variant="destructive" className="mr-auto">Anular</Button>
        <Button variant="outline">Cancelar</Button>
        <Button>Guardar Cambios</Button>
      </>
    ),
  },
};

// 2. Create mode (no instanceId, so no sidebar)
export const CreateMode: Story = {
  args: {
    entityType: 'sale_order',
    title: 'Nueva Nota de Venta',
    icon: 'receipt-text',
    breadcrumb: [
      { label: 'Ventas', href: '#' },
      { label: 'Órdenes', href: '#' },
      { label: 'Nueva', href: '#' },
    ],
    children: <MockForm />,
    footer: (
      <>
        <div className="flex-1" />
        <Button variant="outline">Cancelar</Button>
        <Button>Crear Nota de Venta</Button>
      </>
    ),
  },
};

// 3. Read-only mode (no footer, displays readonly badge)
export const ReadonlyMode: Story = {
  args: {
    entityType: 'stock_move',
    title: 'Movimiento de Inventario',
    displayId: 'MOV-8812',
    icon: 'arrow-right-left',
    readonly: true,
    instanceId: 8812, // shows history if exists
    breadcrumb: [
      { label: 'Inventario', href: '#' },
      { label: 'Movimientos', href: '#' },
    ],
    children: <MockDetailView />,
  },
};
