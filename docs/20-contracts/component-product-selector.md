---
layer: 20-contracts
doc: component-product-selector
status: active
owner: frontend-team
last_review: 2026-05-21
stability: stable
---

# Contrato: ProductSelector

El componente `ProductSelector` y sus subcomponentes conforman la familia de selección de productos en catálogo dentro de `@/components/shared`. 

Fueron extraídos del módulo POS y ahora están diseñados de manera agnóstica a reglas de negocio específicas (ej. verificación de stock compleja, listas de materiales de manufactura) para poder reutilizarse en otras vistas, como la **Calculadora de Costos** o futuros asistentes de órdenes.

## Cuándo usar `ProductSelector`

- **SÍ**: Cuando necesitas una interfaz rica (Grid con imágenes) para navegar por el catálogo completo de productos con filtrado por categorías y buscador integrado.
- **NO**: Cuando estás seleccionando un producto en un formulario simple o una tabla de línea (ej. `ProductCombobox` o `Select` nativo).
- **NO**: Si la cantidad de espacio disponible es un popover o un drawer muy pequeño (el selector de productos requiere un área de al menos 40vh para scrollear cómodamente y un grid responsive).

## Propuesta de API

El orquestador agrupa: `SearchBar`, `CategoryFilter`, y `ProductGrid`. Adicionalmente, el `VariantSelectorModal` se puede invocar según sea necesario.

### ProductSelector Props

```tsx
interface ProductSelectorProps {
    // Orígenes de datos
    products: BaseProduct[]
    categories: ProductCategory[]
    
    // Estado y handlers del buscador
    searchTerm: string
    onSearchChange: (value: string) => void
    onSearchEnter?: () => void
    
    // Estado y handlers de categorías
    selectedCategoryId: number | null
    onSelectCategory: (id: number | null) => void
    
    // Interacciones del Grid
    onProductClick: (product: BaseProduct) => void
    onToggleFavorite?: (productId: number) => void
    
    // Estrategia de negocio inyectada
    isProductDisabled?: (product: BaseProduct) => boolean
    limits?: Record<number, number>
    
    // Extensibilidad de UI
    priceRenderer?: (product: BaseProduct) => React.ReactNode
}
```

### Casos de Uso Comunes

#### 1. POS (Punto de Venta)
El POS usa el grid pero inyecta funciones como `isPOSProductDisabled` (para deshabilitar productos sin stock o configuraciones de manufactura inválidas) y maneja los favoritos. Ocupa todo el contenedor y renderiza el `sale_price` nativamente.

#### 2. Cost Calculator (Calculadora de Costos)
La Calculadora utiliza el `ProductSelector` para la búsqueda pero anula el campo de precio por defecto utilizando `priceRenderer` para poder mostrar el costo del material base (`cost_price`) en vez del precio de venta, y además no provee una regla estricta de `isProductDisabled` (todo es seleccionable para cotizar).

## Componentes Compartidos Relacionados

- `VariantSelectorModal`: Modal para selección de sub-variantes de un producto técnico (template). Posee su propio hook `useVariants` que delega llamadas al API sin romper el Invariante #4 de FSD.
- `ProductGrid`: El componente puro de la grilla virtualizada, útil si se desea armar una UI distinta pero reutilizando las tarjetas de productos.

## ⚠️ Restricciones Técnicas

El `ProductGrid` utiliza **VirtuosoGrid** para el renderizado eficiente de cientos de productos. Esto **requiere explícitamente que el contenedor padre tenga una altura definida** (ej. `flex-1 min-h-0` o una altura fija en pixeles). Si colapsa a altura cero, la grilla no se dibujará.
