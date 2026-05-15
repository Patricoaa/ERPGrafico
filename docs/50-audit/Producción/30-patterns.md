# 30 — Patrones de Implementación

> Especificaciones detalladas de los componentes/abstracciones nuevas que aparecen referenciadas en [20-task-list.md](20-task-list.md). Cada patrón incluye API, ejemplo de uso y consideraciones de migración.

---

## Patrón: `OutsourcedServiceForm`

**ID:** P-OSF
**Usado por:** TASK-101
**Ubicación:** `frontend/features/production/components/forms/OutsourcedServiceForm.tsx`

### Motivación
Tres copias (BOM, WorkOrder material, WorkOrder outsourcing) del mismo form: servicio + proveedor + cantidad + UoM + precio bruto + documento. Mismas validaciones, misma conversión bruto/neto, mismo hardcode `1.19`.

### API

```tsx
interface OutsourcedServiceFormValues {
  component: string          // product id (servicio)
  component_name?: string
  quantity: number
  uom: string                // uom id
  uom_name?: string
  supplier: string           // contact id
  supplier_name?: string
  gross_price: number        // precio bruto unitario
  document_type: 'FACTURA' | 'BOLETA'
  notes?: string
}

interface OutsourcedServiceFormProps {
  value: Partial<OutsourcedServiceFormValues>
  onChange: (val: OutsourcedServiceFormValues) => void

  /** Editable o readonly (e.g. cuando ya hay OC generada) */
  disabled?: boolean

  /** Si está dentro de un BOMFormModal, ocultar campos no aplicables */
  variant?: 'bom' | 'workorder'

  /** Para excluir productos (e.g. el propio producto de la OT) */
  excludeProductIds?: (string | number)[]

  /** Layout */
  layout?: 'horizontal' | 'vertical'

  /** Callback opcional al hacer click en submit (form se valida internamente) */
  onSubmit?: () => void
  onCancel?: () => void
}

export function OutsourcedServiceForm(props: OutsourcedServiceFormProps): JSX.Element
```

### Schema Zod (exportado)

```ts
export const outsourcedServiceSchema = z.object({
  component: z.string().min(1, "Servicio requerido"),
  quantity: z.coerce.number().min(0.0001, "Cantidad debe ser > 0"),
  uom: z.string().min(1, "Unidad requerida"),
  supplier: z.string().min(1, "Proveedor requerido"),
  gross_price: z.coerce.number().min(1, "Monto bruto requerido"),
  document_type: z.enum(["FACTURA", "BOLETA"]).default("FACTURA"),
  notes: z.string().optional(),
})
```

### Conversión bruto/neto

El componente expone `gross_price` (input del usuario) pero al persistir devuelve `unit_price` (neto). La conversión usa `useVatRate()`:

```ts
const { multiplier } = useVatRate()
const net_price = Math.round(gross_price / multiplier)
```

### Migración de los consumers

**Antes** (BOMFormModal:786-963, ~180 LOC):
```tsx
<TableRow>
  <TableCell><ProductSelector ... /></TableCell>
  <TableCell><AdvancedContactSelector ... /></TableCell>
  // ... 5 TableCells más
</TableRow>
```

**Después:**
```tsx
<OutsourcedServiceForm
  variant="bom"
  value={serviceFields[index]}
  onChange={(val) => form.setValue(`service_lines.${index}`, val)}
/>
```

### Tests opcionales (vitest)

```tsx
test('OutsourcedServiceForm calcula neto desde bruto', () => {
  // mock useVatRate to return 1.19
  const { result } = renderHook(() => useForm())
  render(<OutsourcedServiceForm value={{ gross_price: 1190 }} onChange={...} />)
  // assert hidden net_price = 1000
})
```

---

## Patrón: `useVatRate`

**ID:** P-VAT
**Usado por:** TASK-102, TASK-103
**Ubicación:** `frontend/hooks/useVatRate.ts`

### API

```ts
export function useVatRate(): {
  rate: number          // ej. 19 (porcentaje)
  multiplier: number    // ej. 1.19
  isLoading: boolean
}
```

### Implementación

```ts
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const VAT_QUERY_KEY = ['accounting', 'vat']

export function useVatRate() {
  const { data, isLoading } = useQuery({
    queryKey: VAT_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get('/accounting/settings/vat/')
      return res.data as { rate: number; multiplier: number }
    },
    staleTime: Infinity, // raramente cambia
  })
  return {
    rate: data?.rate ?? 19,
    multiplier: data?.multiplier ?? 1.19,
    isLoading,
  }
}
```

### Endpoint backend

`GET /accounting/settings/vat/` retorna `{ rate: 19.0, multiplier: 1.19 }`. Existente en `AccountingSettings.vat_rate` (verificar en `backend/accounting/models.py`).

### Caso de no usar el hook (servidor / contexto sin React)

Para contextos no-React (e.g. cálculos en utils): exponer una función pura `getVatMultiplier()` que lee de un store global o environment. **Pero el uso normal es vía hook.**

---

## Patrón: `STAGES_REGISTRY`

**ID:** P-STG
**Usado por:** TASK-104
**Ubicación:** `frontend/features/production/constants/stages.ts`

### Definición canónica

```ts
import { Package, FileText, CheckCircle2, Printer, Layers, Ban, type LucideIcon } from 'lucide-react'

export type StageId =
  | 'MATERIAL_ASSIGNMENT'
  | 'MATERIAL_APPROVAL'
  | 'OUTSOURCING_ASSIGNMENT'
  | 'PREPRESS'
  | 'PRESS'
  | 'POSTPRESS'
  | 'OUTSOURCING_VERIFICATION'
  | 'RECTIFICATION'
  | 'FINISHED'
  | 'CANCELLED'

export interface StageMeta {
  id: StageId
  label: string
  icon: LucideIcon
  color: string                // tailwind class, semantic
  alwaysShow: boolean          // si se muestra en wizard aunque no aplique
  showInKanban: boolean        // si la columna kanban existe
  order: number
}

export const STAGES_REGISTRY: Record<StageId, StageMeta> = {
  MATERIAL_ASSIGNMENT:      { id: 'MATERIAL_ASSIGNMENT',      label: 'Asignación de Materiales',     icon: Package,      color: 'bg-secondary',     alwaysShow: true,  showInKanban: true,  order: 1 },
  MATERIAL_APPROVAL:        { id: 'MATERIAL_APPROVAL',        label: 'Aprobación de Stock',          icon: CheckCircle2, color: 'bg-info/10',       alwaysShow: false, showInKanban: true,  order: 2 },
  OUTSOURCING_ASSIGNMENT:   { id: 'OUTSOURCING_ASSIGNMENT',   label: 'Asignación de Tercerizados',   icon: Package,      color: 'bg-warning/10',    alwaysShow: true,  showInKanban: false, order: 3 },
  PREPRESS:                 { id: 'PREPRESS',                 label: 'Pre-Impresión',                icon: FileText,     color: 'bg-primary/10',    alwaysShow: false, showInKanban: true,  order: 4 },
  PRESS:                    { id: 'PRESS',                    label: 'Impresión',                    icon: Printer,      color: 'bg-warning/10',    alwaysShow: false, showInKanban: true,  order: 5 },
  POSTPRESS:                { id: 'POSTPRESS',                label: 'Post-Impresión',               icon: Layers,       color: 'bg-info/5',        alwaysShow: false, showInKanban: true,  order: 6 },
  OUTSOURCING_VERIFICATION: { id: 'OUTSOURCING_VERIFICATION', label: 'Verificación de Tercerizados', icon: Package,      color: 'bg-warning/10',    alwaysShow: false, showInKanban: false, order: 7 },
  RECTIFICATION:            { id: 'RECTIFICATION',            label: 'Rectificación',                icon: Package,      color: 'bg-primary/10',    alwaysShow: false, showInKanban: false, order: 8 },
  FINISHED:                 { id: 'FINISHED',                 label: 'Finalizada',                   icon: CheckCircle2, color: 'bg-success/10',    alwaysShow: true,  showInKanban: true,  order: 9 },
  CANCELLED:                { id: 'CANCELLED',                label: 'Anulada',                      icon: Ban,          color: 'bg-muted/50',      alwaysShow: false, showInKanban: true,  order: 10 },
}

export const STAGES_ORDERED: StageMeta[] = Object.values(STAGES_REGISTRY).sort((a, b) => a.order - b.order)
```

### Uso en wizard (filtrado dinámico)

```ts
import { STAGES_ORDERED } from '../constants/stages'

function getFilteredStages(order: WorkOrder): StageMeta[] {
  return STAGES_ORDERED.filter((stage) => {
    if (stage.alwaysShow) return true
    // ... condiciones específicas
  })
}
```

### Uso en kanban

```ts
import { STAGES_ORDERED } from '../constants/stages'

const KANBAN_STAGES = STAGES_ORDERED.filter(s => s.showInKanban)
```

### Migración de los consumers

- [WorkOrderWizard.tsx:46-56](../../../frontend/features/production/components/WorkOrderWizard.tsx#L46-L56): borrar `BASE_STAGES` literal; importar `STAGES_ORDERED`.
- [WorkOrderKanban.tsx:31-39](../../../frontend/features/production/components/WorkOrderKanban.tsx#L31-L39): borrar `STAGES` literal; importar `KANBAN_STAGES`.

---

## Patrón: `ManufacturingSpecsEditor`

**ID:** P-MSE
**Usado por:** TASK-108, TASK-109
**Ubicación:** `frontend/components/shared/manufacturing/ManufacturingSpecsEditor.tsx`

### Motivación
La configuración "switches por fase + textareas de specs + folio + design_files + print_type" aparece en `AdvancedManufacturingModal` (417 LOC), `WorkOrderMaterials` (252 LOC) y dispersa en `WorkOrderForm`.

### Schema canónico

```ts
// schema.ts
import { z } from 'zod'

export const manufacturingDataSchema = z.object({
  phases: z.object({
    prepress: z.boolean().default(false),
    press: z.boolean().default(false),
    postpress: z.boolean().default(false),
  }),
  specifications: z.object({
    prepress: z.string().default(''),
    press: z.string().default(''),
    postpress: z.string().default(''),
  }),
  design_needed: z.boolean().default(false),
  design_files: z.array(z.union([z.instanceof(File), z.string()])).default([]), // File para upload, string para existing
  folio_enabled: z.boolean().default(false),
  folio_start: z.string().default(''),
  print_type: z.enum(['offset', 'digital', 'especial']).nullable().default(null),
  internal_notes: z.string().default(''),
  product_description: z.string().default(''),
  contact: z.object({
    id: z.number(),
    name: z.string(),
    tax_id: z.string().nullable().optional(),
  }).nullable().default(null),
})

export type ManufacturingData = z.infer<typeof manufacturingDataSchema>
```

### API del componente

```tsx
interface ManufacturingSpecsEditorProps {
  value: ManufacturingData
  onChange: (val: ManufacturingData) => void

  /** Mostrar campo de contacto (solo en checkout) */
  showContact?: boolean

  /** Mostrar campo product_description (solo si no tiene BOM) */
  showProductDescription?: boolean

  /** Defaults heredados del producto (mfg_enable_prepress, etc.) */
  productDefaults?: {
    mfg_enable_prepress?: boolean
    mfg_enable_press?: boolean
    mfg_enable_postpress?: boolean
  }

  /** Variante visual (modal grande vs inline en form) */
  variant?: 'modal' | 'inline'

  disabled?: boolean
}
```

### Migración

**AdvancedManufacturingModal** queda como wrapper:
```tsx
export function AdvancedManufacturingModal({ open, onOpenChange, product, onConfirm }) {
  const [data, setData] = useState(productToInitialData(product))
  return (
    <BaseModal open={open} onOpenChange={onOpenChange} title="...">
      <ManufacturingSpecsEditor
        value={data}
        onChange={setData}
        showContact
        showProductDescription={!product.has_bom}
        productDefaults={{ mfg_enable_prepress: product.mfg_enable_prepress, ... }}
        variant="modal"
      />
      <Button onClick={() => onConfirm(data)}>Validar</Button>
    </BaseModal>
  )
}
```

`WorkOrderMaterials.tsx` se elimina (su contenido entero queda subsumido).

---

## Patrón: `WorkOrderCreationCore`

**ID:** P-WCC
**Usado por:** TASK-110, TASK-111, TASK-202
**Ubicación:** `backend/production/services.py`

### Motivación
`create_from_sale_line`, `create_manual`, `create_ot_for_delivery_line` y eventualmente `create_from_request_payload` comparten:
- Validación de `requires_bom_validation`
- Expansión de BOM con conversión UoM
- Creación de history inicial + task

### Helpers extraídos

```python
class WorkOrderService:
    @staticmethod
    def _validate_product_manufacturable(product):
        if product.product_type != Product.Type.MANUFACTURABLE:
            raise ValidationError("El producto debe ser fabricable.")
        if product.requires_bom_validation:
            raise ValidationError(
                f"El producto '{product.name}' es Express y requiere un BOM asignado..."
            )

    @staticmethod
    def _expand_bom_into_materials(work_order, product, requested_qty, qty_uom):
        """Expand active BOM into WorkOrderMaterial rows scaled by qty/yield."""
        active_bom = BillOfMaterials.objects.filter(product=product, active=True).first()
        if not active_bom:
            return []

        from inventory.services import UoMService

        # Convert requested qty to product base UoM
        qty_base = Decimal(str(requested_qty))
        if qty_uom and qty_uom != product.uom:
            try:
                qty_base = UoMService.convert_quantity(qty_base, qty_uom, product.uom)
            except Exception:
                pass

        # Convert BOM yield to product base UoM
        bom_yield_base = active_bom.yield_quantity
        if active_bom.yield_uom and active_bom.yield_uom != product.uom:
            try:
                bom_yield_base = UoMService.convert_quantity(
                    active_bom.yield_quantity, active_bom.yield_uom, product.uom
                )
            except Exception:
                pass

        factor = qty_base / bom_yield_base if bom_yield_base > 0 else Decimal('1')

        materials = []
        for line in active_bom.lines.all():
            mat = WorkOrderMaterial.objects.create(
                work_order=work_order,
                component=line.component,
                quantity_planned=line.quantity * factor,
                uom=line.uom or line.component.uom,
                source='BOM',
                is_outsourced=line.is_outsourced,
                supplier=line.supplier,
                unit_price=line.unit_price,
                document_type=line.document_type,
            )
            materials.append(mat)
        return materials

    @staticmethod
    def _create_initial_artifacts(work_order, *, origin_notes: str, task_meta: dict, user=None):
        """Create WorkOrderHistory + OT_CREATION task. Returns nothing."""
        WorkOrderHistory.objects.create(
            work_order=work_order,
            stage=work_order.current_stage,
            status=work_order.status,
            notes=origin_notes,
            user=user,
        )

        # Skip task creation if product is auto-finalize
        product = work_order.product or (work_order.sale_line.product if work_order.sale_line else None)
        auto_finalize = (
            product.mfg_profile.mfg_auto_finalize
            if product and product.mfg_profile
            else False
        )
        if not auto_finalize:
            WorkflowService.create_task(
                task_type='OT_CREATION',
                title=f"Asignación materiales: {work_order.display_id}",
                description=f"Realizar la asignación de materiales y tercerizados para {work_order.display_id}.",
                content_object=work_order,
                category=Task.Category.TASK,
                data=task_meta,
            )

    @staticmethod
    def _maybe_auto_finalize(work_order, user=None):
        """If product is express (auto_finalize), transition to FINISHED, swallowing errors."""
        product = work_order.product or (work_order.sale_line.product if work_order.sale_line else None)
        auto_finalize = (
            product.mfg_profile.mfg_auto_finalize
            if product and product.mfg_profile
            else False
        )
        if not auto_finalize:
            return

        try:
            with transaction.atomic():
                WorkOrderService.transition_to(
                    work_order,
                    WorkOrder.Stage.FINISHED,
                    notes="Finalización automática (Flujo Express)",
                    user=user,
                )
        except Exception as e:
            logger.exception("Auto-finalize failed for OT-%s", work_order.number)
            WorkOrderHistory.objects.create(
                work_order=work_order,
                stage=work_order.current_stage,
                status=work_order.status,
                notes=f"Fallo en finalización automática: {e}",
            )
```

### Cada `create_*` queda así (~30 LOC)

```python
@staticmethod
@transaction.atomic
def create_from_sale_line(sale_line, files=None):
    product = sale_line.product
    WorkOrderService._validate_product_manufacturable(product)

    work_order = WorkOrder.objects.create(
        description=f"{product.name} - NV-{sale_line.order.number}",
        sale_order=sale_line.order,
        sale_line=sale_line,
        related_note=getattr(sale_line, 'related_note', None),
        status=WorkOrder.Status.DRAFT,
        current_stage=WorkOrder.Stage.MATERIAL_ASSIGNMENT,
        warehouse=_resolve_warehouse_from_deliveries(sale_line.order),  # helper privado
        stage_data=WorkOrderService._map_manufacturing_data(sale_line.manufacturing_data),
    )

    WorkOrderService._attach_files(work_order, files)  # helper privado
    WorkOrderService._expand_bom_into_materials(
        work_order, product, sale_line.quantity, sale_line.uom
    )
    WorkOrderService._create_initial_artifacts(
        work_order,
        origin_notes="OT generada automáticamente desde venta.",
        task_meta={
            'sale_order_id': work_order.sale_order_id,
            'order_type': 'sale',
            'order_number': sale_line.order.number,
            'prefix': 'NV',
        },
    )
    WorkOrderService._maybe_auto_finalize(work_order)
    return work_order
```

---

## Patrón: `StageDataCanonical`

**ID:** P-SDC
**Usado por:** TASK-112, TASK-113, TASK-210
**Ubicación:** `backend/production/stage_data_schema.py` (nuevo)

### Forma canónica

```python
# stage_data_schema.py
from typing import Optional, TypedDict, Literal

class Phases(TypedDict, total=False):
    prepress: bool
    press: bool
    postpress: bool

class Specifications(TypedDict, total=False):
    prepress: str
    press: str
    postpress: str

class Comment(TypedDict):
    id: str
    user: str
    text: str
    timestamp: str

class StageData(TypedDict, total=False):
    _version: Literal[1]
    # Datos universales
    quantity: float
    uom_id: int
    uom_name: str

    # Manufactura
    phases: Phases
    specifications: Specifications
    design_needed: bool
    design_attachments: list[str]    # filenames
    design_approved: bool
    approval_attachment: Optional[str]
    folio_enabled: bool
    folio_start: str
    print_type: Optional[Literal['offset', 'digital', 'especial']]

    # Notas y contexto
    internal_notes: str
    product_description: str
    contact_id: Optional[int]
    contact_name: Optional[str]
    contact_tax_id: Optional[str]

    # Comentarios en el wizard
    comments: list[Comment]

    # Reservado para versión futura
    overrides: dict  # overrides por etapa si en el futuro se necesitan
```

### Migración inline (TASK-210)

```python
def migrate_stage_data_to_v1(data: dict) -> dict:
    """If stage_data has no _version, treat it as legacy and normalize."""
    if data.get('_version'):
        return data

    # Si tiene copias por fase (prepress/press/postpress como dicts), aplanar
    flat = dict(data)
    for phase in ('prepress', 'press', 'postpress'):
        if isinstance(data.get(phase), dict):
            # Tomar valores no-vacíos del primero que tenga datos
            for key, value in data[phase].items():
                if value and not flat.get(key):
                    flat[key] = value
            del flat[phase]  # quitar copia

    flat['_version'] = 1
    return flat
```

### Property en el modelo

```python
class WorkOrder(models.Model):
    # ...

    @property
    def canonical_stage_data(self) -> dict:
        from .stage_data_schema import migrate_stage_data_to_v1
        return migrate_stage_data_to_v1(self.stage_data or {})
```

---

## Patrón: `WorkOrderPdfTemplate`

**ID:** P-PDF
**Usado por:** TASK-203, TASK-313
**Ubicación:** `backend/production/templates/production/work_order_pdf.html`

### Servicio

```python
# services.py
from django.template.loader import render_to_string
from weasyprint import HTML

class WorkOrderPdfService:
    @staticmethod
    def render_pdf(work_order, scan_token: Optional[str] = None) -> bytes:
        context = {
            'wo': work_order,
            'company': CompanySettings.get_solo(),
            'materials_stock': work_order.materials.filter(is_outsourced=False),
            'materials_outsourced': work_order.materials.filter(is_outsourced=True),
            'specs': work_order.canonical_stage_data.get('specifications', {}),
            'qr_url': scan_token and f"{settings.PUBLIC_BASE_URL}/scan/{scan_token}",
        }
        html = render_to_string('production/work_order_pdf.html', context)
        return HTML(string=html, base_url=settings.PUBLIC_BASE_URL).write_pdf()
```

### Template (esqueleto)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 1.5cm; }
    body { font-family: 'Helvetica', sans-serif; font-size: 10pt; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .ot-number { font-size: 24pt; font-weight: bold; }
    .qr { width: 80px; height: 80px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    .specs { margin-top: 20px; padding: 10px; background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="{{ company.logo.url }}" height="50">
      <h1>ORDEN DE TRABAJO</h1>
      <div class="ot-number">{{ wo.display_id }}</div>
    </div>
    {% if qr_url %}
      <img class="qr" src="{% qr_image qr_url %}"> {# template tag custom o weasyprint barcode #}
    {% endif %}
  </div>

  <h2>Cliente: {{ wo.sale_customer_name }}</h2>
  <p>Descripción: {{ wo.description }}</p>
  <p>Fecha entrega: {{ wo.estimated_completion_date }}</p>

  <h3>Especificaciones</h3>
  <div class="specs">
    {% if specs.prepress %}<p><b>Pre-Prensa:</b> {{ specs.prepress }}</p>{% endif %}
    {% if specs.press %}<p><b>Prensa:</b> {{ specs.press }}</p>{% endif %}
    {% if specs.postpress %}<p><b>Post-Prensa:</b> {{ specs.postpress }}</p>{% endif %}
  </div>

  <h3>Materiales de Stock</h3>
  <table>
    <thead>
      <tr><th>Componente</th><th>Cantidad</th><th>UoM</th></tr>
    </thead>
    <tbody>
      {% for m in materials_stock %}
        <tr><td>{{ m.component.name }}</td><td>{{ m.quantity_planned }}</td><td>{{ m.uom.name }}</td></tr>
      {% endfor %}
    </tbody>
  </table>

  {% if materials_outsourced %}
    <h3>Servicios Tercerizados</h3>
    <table>
      <thead>
        <tr><th>Servicio</th><th>Proveedor</th><th>Cantidad</th></tr>
      </thead>
      <tbody>
        {% for m in materials_outsourced %}
          <tr><td>{{ m.component.name }}</td><td>{{ m.supplier.name }}</td><td>{{ m.quantity_planned }}</td></tr>
        {% endfor %}
      </tbody>
    </table>
  {% endif %}
</body>
</html>
```

---

## Patrón: ScanToken para QR

**ID:** P-QR
**Usado por:** TASK-313
**Ubicación:** `backend/production/models.py` + `views.py`

### Modelo

```python
class WorkOrderScanToken(models.Model):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='scan_tokens')
    token = models.CharField(max_length=32, unique=True, default=secrets.token_urlsafe)
    target_stage = models.CharField(max_length=30, choices=WorkOrder.Stage.choices, null=True, blank=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)
```

### Endpoint público

```python
@action(detail=False, methods=['post'], url_path='scan/(?P<token>[^/.]+)')
def scan(self, request, token=None):
    """Public-ish endpoint: scanned QR transitions the OT to next stage."""
    scan_token = get_object_or_404(WorkOrderScanToken, token=token, used_at__isnull=True)
    if scan_token.expires_at < timezone.now():
        return Response({'error': 'Token expirado'}, status=400)
    # transición
    WorkOrderService.transition_to(scan_token.work_order, scan_token.target_stage, user=request.user)
    scan_token.used_at = timezone.now()
    scan_token.used_by = request.user
    scan_token.save()
    return Response({'success': True, 'work_order': scan_token.work_order.display_id})
```

---

## Resumen de patrones por tarea

| Tarea | Patrón |
|---|---|
| TASK-101 | P-OSF (OutsourcedServiceForm) |
| TASK-102/103 | P-VAT (useVatRate) |
| TASK-104 | P-STG (STAGES_REGISTRY) |
| TASK-108/109 | P-MSE (ManufacturingSpecsEditor) |
| TASK-110/111/202 | P-WCC (WorkOrderCreationCore) |
| TASK-112/113/210 | P-SDC (StageDataCanonical) |
| TASK-203 | P-PDF (WorkOrderPdfTemplate) |
| TASK-313 | P-QR (ScanToken) |
