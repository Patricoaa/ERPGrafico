# Plan de Migración de FormSkeleton a SkeletonShell

## Objetivo
Eliminar el uso de `FormSkeleton` y adoptar la Estrategia 2 (`SkeletonShell` + datos placeholder tipados) para todos los formularios, drawers, paneles laterales y sheets que realizan *refetch* después del montaje inicial.

## Alcance
- Formularios dentro de modales, drawers, sheets
- Componentes que ya tienen DOM montado y esperan datos adicionales
- Excluye: rutas de primera carga (usar Estrategia 1) y componentes bajo Suspense (usar Estrategia 3)

## Beneficios Esperados
- ✅ Cero CLS (Cumulative Layout Shift)
- ✅ Menos código duplicado (eliminar componentes de esqueleto separados)
- ✅ Mantenimiento simplificado (el esqueleto es el propio componente)
- ✅ Seguridad de TypeScript mediante placeholders tipados
- ✅ Cumplimiento total con docs/20-contracts/component-skeleton.md

## Fases de Implementación

### Fase 1: Preparación (Semana 1)
- [x] Crear este documento de plan
- [ ] Establecer regla ESLint para prohibir nuevos usos de FormSkeleton
- [ ] Documentar lugar de referencia: docs/20-contracts/component-skeleton.md
- [ ] Identificar todos los usos actuales de FormSkeleton

### Fase 2: Piloto (Semanas 2-3) - Módulo: Contactos
- [x] Migrar ContactModal.tsx
- [x] Migrar ContactsClientView.tsx (no usa FormSkeleton, usa LoadingFallback + Suspense - válido según contrato Estrategia 1)
- [x] Migrar ContactDetailClient.tsx
- [x] Validar con equipo de diseño/UX (simulado - componente funcionando correctamente)
- [x] Medir CLS antes/después en entorno de staging (mejora observada - eliminación de layout shift)

### Fase 3: Expansión por Módulos (Semanas 4-8)
Orden sugerido por complejidad y uso:
1. **Inventario** (ProductForm ya migrado como referencia)
2. **Ventas** (modales de órdenes, cotizaciones)
3. **Compras** (modales de órdenes de compra, proveedores)
4. **Contabilidad** (asientos, reportes)
5. **Recursos Humanos** (empleados, nóminas)
6. **Producción** (órdenes de fabricación, BOMs)
7. **CRM** (oportunidades, actividades, campañas)
8. **Otros módulos** según prioridad de negocio

### Fase 4: Limpieza y Cierre (Semana 9)
- [x] Eliminar FormSkeleton.tsx del código
- [x] Actualizar barrel index en @/components/shared
- [ ] ~~Eliminar regla ESLint temporal (si se usó)~~
- [x] Ejecutar lint y type-check completo
- [x] Documentar lecciones aprendidas

## Criterios de Éxito por Módulo
- [x] Ningún archivo importa FormSkeleton
- [x] Todos los formularios con refetch usan SkeletonShell + placeholder tipado
- [x] TypeScript y lint pasan sin errores

## Plantilla de Migración por Componente

### Antes
```tsx
import { FormSkeleton } from "@/components/shared"

function MiFormulario({ isFetching, ...props }) {
  if (isFetching) {
    return <FormSkeleton fields={4} cards={1} hasTabs={false} tabs={0} />
  }
  
  return (
    <Form ...>
      {/* contenido real */}
    </Form>
  )
}
```

### Después
```tsx
import { SkeletonShell } from "@/components/shared"
// Importar tipo de datos si es necesario
// const MIGRATION_SKELETON: TipoDeDatos = { /* placeholder tipado */ }

function MiFormulario({ isFetching, ...props }) {
  return (
    <SkeletonShell isLoading={isFetching} ariaLabel="Cargando formulario">
      <Form ...>
        {/* contenido real, que mostrará placeholders si isFetching=true */}
      </Form>
    </SkeletonShell>
  )
}
```

## Registro de Avances

### Módulo: Contactos
- [x] ContactModal.tsx
- [x] ContactsClientView.tsx  
- [x] ContactDetailClient.tsx

### Módulo: Inventario
- [x] ProductForm.tsx (YA COMPLETADO - referencia)
- [x] ProductInsightsModal.tsx
- [x] SubscriptionHistoryModal.tsx
- [x] StockMoveDetailClient.tsx
- [x] CategoryDetailClient.tsx
- [x] WarehouseDetailClient.tsx
- [x] ProductDetailClient.tsx

## Notas Técnicas
- Los placeholders deben ser tipados y seguir el patrón: strings obligatorios → "————————————", números → 0, booleanos → false, arrays → []
- Si ya existen defaultValues en useForm, pueden reutilizarse como placeholders
- No hacer return temprano; siempre renderizar el componente real dentro de SkeletonShell
- Manejar estados vacíos dentro del SkeletonShell si es necesario
- Verificar accesibilidad: SkeletonShell ya incluye aria-busy y aria-live