---
doc: product-pricing-implementation-plan
status: planned
owner: fullstack-team
last_review: 2026-05-20
---

# Plan de Implementación: Gestión de Precios de Productos

Plan de implementación incremental en 4 PRs ordenados por dependencia y riesgo. Cada PR es autónomo y deployable sin romper funcionalidad existente.

> **Auditoría técnica completa**: ver [README.md](./README.md).

---

## Estado de PRs

| PR | Título | Estado | Estimado | Riesgo |
|----|--------|--------|----------|--------|
| PR-1 | Tab Precios consolidada + estados de reglas | ✅ Completado | 3–4 h | 🟢 Bajo |
| PR-2 | Herencia de precios en variantes | ✅ Completado | 6–8 h | 🟡 Medio |
| PR-3 | Precios independientes por UoM de venta | ✅ Completado | 8–10 h | 🟡 Medio |
| PR-4 | Filtrado de UoMs en POS por `allowed_sale_uoms` | ✅ Completado | 2–3 h | 🟢 Bajo |

Leyenda: ⏳ Pendiente · 🔄 En progreso · ✅ Completado · 🚫 Bloqueado

---

## PR-1 — Tab "Precios" consolidada + estados de reglas

**Objetivo**: mover `ProductPricingSection` de la tab "General" a una tab "Precios" dedicada, que también absorbe el contenido actual de la tab "Reglas". Sin cambios de modelo ni backend.

**Precondiciones**:
- `npm run type-check` verde antes de comenzar.
- Leer `docs/20-contracts/component-decision-tree.md` — no crear componentes nuevos si ya existen.

### Tareas

#### 1.1 — Renombrar y reconfigurar tab en `ProductForm.tsx`

- [ ] En el array `tabItems` ([ProductForm.tsx:615](../../frontend/features/inventory/components/ProductForm.tsx#L615)), cambiar la entrada `"pricing"`:
  ```ts
  // Antes
  { value: "pricing", label: "Reglas", icon: Scale, ... }
  // Después
  { value: "pricing", label: "Precios", icon: DollarSign, ... }
  ```
- [ ] Mover el bloque `<ProductPricingSection ... />` desde el `FormTabsContent value="general"` al `FormTabsContent value="pricing"`, encima de `<ProductPricingTab .../>`.
- [ ] Actualizar `getTabsWithErrors()` ([ProductForm.tsx:112](../../frontend/features/inventory/components/ProductForm.tsx#L112)): los campos `sale_price`, `sale_price_gross` y `sale_uom` deben contar para la tab `"pricing"`, no para `"general"`.
- [ ] Actualizar `FIELD_LABELS` ([ProductForm.tsx:425](../../frontend/features/inventory/components/ProductForm.tsx#L425)): verificar que los labels de campos de precio son correctos.
- [ ] Verificar que la condición de visibilidad `!canBeSold || productType === 'SUBSCRIPTION'` sigue correcta para la nueva tab consolidada.

#### 1.2 — Limpiar tab "General"

- [ ] En `FormTabsContent value="general"`, eliminar el componente `<ProductPricingSection />` y su import si queda huérfano.
- [ ] Verificar que el tab "General" renderiza correctamente con solo `<ProductBasicInfo />`.

#### 1.3 — Estructura interna de la tab "Precios"

- [ ] En el `FormTabsContent value="pricing"`, establecer el orden visual:
  1. `<ProductPricingSection />` — precio base (net/gross + toggle dinámico + sale_uom)
  2. `<ProductPricingTab />` — lista de reglas (sin cambios funcionales)
- [ ] Agregar un `<FormSection>` con título "Precio Base" envolviendo `ProductPricingSection` para separación visual consistente con el resto del formulario.
- [ ] Agregar un `<FormSection>` con título "Listas de Precios" envolviendo `ProductPricingTab`.

#### 1.4 — Estado visual de reglas vencidas en `ProductPricingTab`

- [ ] En `frontend/features/inventory/components/product/ProductPricingTab.tsx`, agregar función helper:
  ```ts
  function getRuleStatus(rule: PricingRule): 'active' | 'expired' | 'inactive' {
    if (!rule.active) return 'inactive'
    if (rule.end_date && new Date(rule.end_date) < new Date()) return 'expired'
    return 'active'
  }
  ```
- [ ] En la columna "Estado" de la tabla de reglas, usar `<StatusBadge>` con tres variantes:
  - `active` → label "Activa", variant `success`
  - `expired` → label "Vencida", variant `secondary` (tono muted, no es error)
  - `inactive` → label "Inactiva", variant `outline`
- [ ] Verificar que `StatusBadge` admite estos tres estados — si no, extender el mapa de variantes en `StatusBadge`.

#### 1.5 — Validación final PR-1

- [ ] `npm run type-check` — sin errores
- [ ] `npm run lint` — sin advertencias nuevas
- [ ] Prueba manual: crear producto nuevo, verificar que "General" ya no tiene campos de precio
- [ ] Prueba manual: editar producto existente, verificar que precios y reglas aparecen en tab "Precios"
- [ ] Prueba manual: producto SUBSCRIPTION — la tab "Precios" debe seguir oculta
- [ ] Prueba manual: regla con `end_date` pasado muestra badge "Vencida"

---

## PR-2 — Herencia de precios en variantes

**Objetivo**: permitir que las variantes hereden el precio del template de forma centralizada, eliminando la necesidad de actualizar cada variante manualmente.

**Precondiciones**:
- PR-1 completado y mergeado.
- Leer `docs/30-playbooks/add-migration.md` antes de escribir la migración.
- Leer `docs/10-architecture/backend-apps.md` — la lógica de resolución va en `services.py`, no en la vista.

### Tareas

#### 2.1 — Migración de base de datos

- [ ] Crear migración en `backend/inventory/migrations/`:
  ```python
  # Nuevos campos en Product
  price_inheritance_mode = models.CharField(
      max_length=10,
      choices=[('INHERIT', 'Heredar'), ('OVERRIDE', 'Propio'), ('SURCHARGE', 'Sobrecargo')],
      default='INHERIT',
  )
  price_surcharge = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
  ```
- [ ] Verificar que el `default='INHERIT'` no rompe variantes existentes — al migrar, todas quedan en modo herencia, que es el comportamiento más seguro (no altera ningún precio calculado hasta que el usuario cambie explícitamente a OVERRIDE).
- [ ] Ejecutar `python manage.py migrate` en entorno de desarrollo y confirmar que no hay errores.

#### 2.2 — Lógica de resolución en `PricingService`

- [ ] En `backend/inventory/services.py` (o donde viva `PricingService`), agregar método:
  ```python
  @staticmethod
  def resolve_variant_price(variant: Product) -> tuple[Decimal, Decimal]:
      """Devuelve (price_net, price_gross) aplicando herencia."""
      if not variant.parent_template_id:
          return variant.sale_price, variant.sale_price_gross
      if variant.price_inheritance_mode == 'INHERIT':
          t = variant.parent_template
          return t.sale_price, t.sale_price_gross
      elif variant.price_inheritance_mode == 'SURCHARGE':
          t = variant.parent_template
          surcharge = variant.price_surcharge or 0
          net = t.sale_price + surcharge
          return net, round(net * Decimal('1.19'))
      return variant.sale_price, variant.sale_price_gross
  ```
- [ ] Hacer que el serializer de `Product` incluya `price_inheritance_mode`, `price_surcharge`, y un campo calculado `effective_price_net` cuando el producto es variante.
- [ ] Verificar que `generate_variants/` endpoint establece `price_inheritance_mode='INHERIT'` en las variantes generadas.

#### 2.3 — Endpoint de sincronización masiva

- [ ] Agregar acción en `ProductViewSet`:
  ```python
  @action(detail=True, methods=['post'], url_path='sync-variant-prices')
  def sync_variant_prices(self, request, pk=None):
      """Establece INHERIT en todas las variantes del template."""
      template = self.get_object()
      updated = template.variants.update(price_inheritance_mode='INHERIT')
      return Response({'updated': updated})
  ```
- [ ] Agregar la URL al router de inventory.

#### 2.4 — Tipos TypeScript

- [ ] En `frontend/features/inventory/types/index.ts`, extender `Product`:
  ```ts
  price_inheritance_mode?: 'INHERIT' | 'OVERRIDE' | 'SURCHARGE'
  price_surcharge?: string | number | null
  effective_price_net?: string | number   // calculado por backend
  ```

#### 2.5 — UI en `ProductVariantsTab`

- [ ] En la tabla de variantes ([ProductVariantsTab.tsx](../../frontend/features/inventory/components/product/ProductVariantsTab.tsx)), agregar columnas:
  - **Modo precio**: badge `Hereda` / `Propio` / `Sobrecargo`
  - **Precio efectivo**: mostrar `effective_price_net` (o el que corresponda por modo)
  - **Sobrecargo**: mostrar `price_surcharge` solo cuando modo es `SURCHARGE`, editable inline
- [ ] Reemplazar la columna "Precio" actual (que muestra `sale_price` directo) por "Precio efectivo".
- [ ] En `VariantQuickEditForm`, agregar campo `price_inheritance_mode` con radio group o select, y campo `price_surcharge` condicional (visible solo si modo = SURCHARGE).
- [ ] En `BulkVariantEditForm`, agregar campo `price_inheritance_mode` para actualización masiva.
- [ ] Agregar botón "Sincronizar precios" en la cabecera de la tab Variantes que llame al endpoint `sync-variant-prices`. Confirmación previa con `ActionConfirmModal`.

#### 2.6 — Validación final PR-2

- [ ] `npm run type-check` — sin errores
- [ ] `pytest backend/inventory/tests -v` — tests de variantes sin regresiones
- [ ] Prueba manual: crear template con variantes, cambiar precio del template, confirmar que variantes en modo INHERIT muestran el nuevo precio efectivo
- [ ] Prueba manual: variante en modo SURCHARGE muestra template_price + surcharge
- [ ] Prueba manual: variante en modo OVERRIDE mantiene su precio sin importar cambios del template
- [ ] Prueba manual: botón "Sincronizar precios" pone todas las variantes en INHERIT
- [ ] Prueba manual: POS agrega variante y muestra precio correcto según modo de herencia

---

## PR-3 — Precios independientes por UoM de venta

**Objetivo**: permitir fijar un precio base específico por UoM de venta habilitada para un producto, con fallback a conversión proporcional cuando no hay precio definido.

**Precondiciones**:
- PR-1 completado y mergeado.
- PR-2 no es prerrequisito estricto, pero si ya está mergeado, verificar que `resolve_variant_price` también consulta `ProductUoMPrice`.
- Leer `docs/30-playbooks/add-migration.md`.

### Tareas

#### 3.1 — Modelo `ProductUoMPrice`

- [ ] Crear modelo en `backend/inventory/models.py`:
  ```python
  class ProductUoMPrice(models.Model):
      product     = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='uom_prices')
      uom         = models.ForeignKey(UoM, on_delete=models.PROTECT)
      price_net   = models.DecimalField(max_digits=12, decimal_places=0)
      price_gross = models.DecimalField(max_digits=12, decimal_places=0)

      class Meta:
          unique_together = ('product', 'uom')
          verbose_name = 'Precio por UoM'

      def save(self, *args, **kwargs):
          # Sync net↔gross igual que Product.save()
          if self.price_net and not self.price_gross:
              self.price_gross = round(self.price_net * Decimal('1.19'))
          elif self.price_gross and not self.price_net:
              self.price_net = round(self.price_gross / Decimal('1.19'))
          super().save(*args, **kwargs)
  ```
- [ ] Crear migración y aplicar en desarrollo.
- [ ] Registrar en `admin.py` con inline en `ProductAdmin`.

#### 3.2 — Serializer y ViewSet

- [ ] Crear `ProductUoMPriceSerializer` en `backend/inventory/serializers.py`.
- [ ] Anidar en `ProductSerializer` como campo `uom_prices` (read/write, nested).
- [ ] Crear `ProductUoMPriceViewSet` con filtro por `product` para endpoints individuales:
  - `GET /inventory/products/{id}/uom-prices/`
  - `POST /inventory/products/{id}/uom-prices/`
  - `PUT /inventory/products/{id}/uom-prices/{uom_id}/`
  - `DELETE /inventory/products/{id}/uom-prices/{uom_id}/`

#### 3.3 — Actualizar `PricingService.get_product_price()`

- [ ] Antes de aplicar la conversión proporcional para una UoM, consultar `ProductUoMPrice`:
  ```python
  uom_price = ProductUoMPrice.objects.filter(product=product, uom=uom).first()
  if uom_price:
      base_net = uom_price.price_net
      base_gross = uom_price.price_gross
  else:
      # fallback: conversión proporcional actual
      base_net = product.sale_price * (uom.ratio / product.uom.ratio)
  ```
- [ ] El endpoint `effective_sale_price` ya recibe `uom_id` — sin cambios en la firma, solo en la lógica interna.

#### 3.4 — Tipos TypeScript

- [ ] Agregar interfaz en `frontend/features/inventory/types/index.ts`:
  ```ts
  export interface ProductUoMPrice {
      id?: number
      uom: number
      uom_name?: string
      price_net: string | number
      price_gross: string | number
  }
  ```
- [ ] Extender `Product` con campo `uom_prices?: ProductUoMPrice[]`.

#### 3.5 — UI en tab "Precios" (extensión de PR-1)

- [ ] En `ProductPricingSection`, agregar sección condicional que se muestra cuando `allowed_sale_uoms.length > 1`:
  - Título: "Precios por unidad de venta"
  - Tabla con columnas: UoM | Precio Neto | Precio Bruto | Estado
  - Estado: badge `Definido` si hay entrada en `uom_prices`, badge `Hereda (conversión)` si no la hay
  - Cada fila es editable inline con campos número para precio neto y bruto con sync bidireccional
  - La fila de la UoM base está bloqueada (es el precio principal del producto)
- [ ] Conectar los cambios a través del form de `react-hook-form` siguiendo el patrón de campos anidados existente.
- [ ] Al guardar el producto, enviar `uom_prices` junto al resto del payload (o usar los endpoints individuales si se prefiere separar la operación).

#### 3.6 — Validación final PR-3

- [ ] `npm run type-check` — sin errores
- [ ] `pytest backend/inventory/tests -v`
- [ ] Prueba manual: producto con 2 UoMs habilitadas, definir precio para la segunda UoM, agregar al POS con esa UoM y confirmar que el precio es el definido (no la conversión proporcional)
- [ ] Prueba manual: UoM sin precio propio → precio calculado por ratio (comportamiento anterior preservado)
- [ ] Prueba manual: cambiar precio base del producto → UoMs sin precio propio actualizan su precio calculado en POS; UoMs con precio propio NO se ven afectadas

---

## PR-4 — Filtrado de UoMs en POS por `allowed_sale_uoms`

**Objetivo**: el selector de UoM en el ítem del carrito POS debe mostrar únicamente las UoMs habilitadas para ese producto, no todas las UoMs de la misma categoría.

**Precondiciones**:
- Ninguno de los PRs anteriores es prerrequisito estricto (cambio aislado en el frontend del POS).

### Tareas

#### 4.1 — Exponer `allowed_sale_uom_ids` en el tipo `Product` del POS

- [ ] En `frontend/types/pos.ts`, verificar que `Product` incluye `allowed_sale_uoms` o `allowed_sale_uom_ids` (lista de IDs). Si no existe, agregarlo como `allowed_sale_uoms?: number[]`.
- [ ] Verificar que el endpoint de productos del POS serializa este campo. Si no, agregar al serializer de POS products.

#### 4.2 — Filtrar UoMs disponibles en `CartItem`

- [ ] Localizar dónde se construye la lista de UoMs disponibles para el selector de UoM dentro del componente de ítem del carrito (buscar referencias a `onItemUomChange` y al componente `UoMSelector` o equivalente).
- [ ] Filtrar la lista de `uoms` global del contexto POS usando `product.allowed_sale_uoms`:
  ```ts
  const availableUoms = uoms.filter(u =>
      !product.allowed_sale_uoms?.length ||
      product.allowed_sale_uoms.includes(u.id)
  )
  ```
- [ ] Si `allowed_sale_uoms` está vacío o undefined, mantener comportamiento actual (sin filtro) como fallback seguro.

#### 4.3 — Validación final PR-4

- [ ] `npm run type-check` — sin errores
- [ ] Prueba manual: producto con `allowed_sale_uoms = [UoM-A, UoM-B]` → el selector en POS solo muestra esas dos UoMs
- [ ] Prueba manual: producto sin `allowed_sale_uoms` configurado → el selector muestra todas las UoMs de la categoría (comportamiento anterior preservado)
- [ ] Prueba manual: cambiar UoM en POS → precio se recalcula correctamente (sin regresión del flujo actual)

---

## Dependencias entre PRs

```
PR-1 (tab Precios)
│
├── PR-2 (herencia variantes)    — puede parallelizarse con PR-3
│
├── PR-3 (precios por UoM)       — puede parallelizarse con PR-2
│
└── PR-4 (filtro UoM en POS)     — independiente, puede hacerse en cualquier momento
```

PR-2 y PR-3 son independientes entre sí pero ambos requieren PR-1 mergeado para que la UI de precios adicional tenga dónde vivir.

---

## Consideraciones de rollback

| PR | Estrategia de rollback |
|----|----------------------|
| PR-1 | Revertir commit — sin cambios de modelo, rollback inmediato |
| PR-2 | Migración reversible: `price_inheritance_mode` tiene `default='INHERIT'` — revertir migración con `migrate app 000X_prev`. Los precios de variantes en OVERRIDE quedan en `sale_price` original |
| PR-3 | Migración reversible: tabla `ProductUoMPrice` se puede drop sin afectar datos de `Product`. Revertir migración con `migrate app 000X_prev` |
| PR-4 | Revertir commit — sin cambios de modelo ni migración |
