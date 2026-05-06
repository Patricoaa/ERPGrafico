---
layer: 20-contracts
doc: module-layout-navigation
status: active
owner: frontend-team
stability: stable
---

# Contrato: Layout y Navegación Dinámica por Módulo

Este contrato define el patrón estándar para la estructura de carpetas, navegación de tabs/breadcrumbs y gestión de layouts en el **App Router de Next.js**. Reemplaza el antiguo patrón monolítico basado exclusivamente en `?view=`.

## 1. Estructura de Archivos del Módulo

Cada módulo en `app/(dashboard)/[module]/` DEBE seguir esta estructura:

```
[module]/
├── layout.tsx             # Server Component: Define el contenedor y el Header
├── [Module]Header.tsx     # Client Component: Lógica de tabs y breadcrumbs
├── page.tsx               # Server Component: Redireccionador de compatibilidad
└── [view]/
    └── page.tsx           # Server Component: Punto de entrada físico de la vista
```

## 2. El Componente Header (`[Module]Header.tsx`)

Es el cerebro de la navegación del módulo. Debe ser un **Client Component** que consuma el estado de la URL.

### Responsabilidades:
- **Detección de Segmentos**: Usar `usePathname()` para identificar en qué vista física se encuentra el usuario.
- **Mapeo de Tabs**: Transformar el segmento de la URL (ej. `/sales/terminals`) en el valor activo del tab (ej. `pos`).
- **Gestión de Breadcrumbs**: Configurar el objeto `navigation` para el `PageHeader` inyectando el `moduleName`.
- **Sub-tabs**: Manejar sub-navegación mediante el parámetro `?tab=`.

### Ejemplo de Contrato de Navegación:
```tsx
const navigation = {
    moduleName: "Ventas",
    moduleHref: "/sales",
    tabs: [...],
    activeValue: currentSegment,
    subActiveValue: searchParams.get('tab')
}
```

## 3. El Layout del Módulo (`layout.tsx`)

Debe ser un **Server Component** para asegurar la eficiencia del renderizado y el SEO.

### Reglas:
- Debe envolver a los `children` en el token de estilo estándar `LAYOUT_TOKENS.view`.
- Debe inyectar el componente `[Module]Header` en la parte superior.
- No debe manejar lógica de negocio, solo estructura visual.

## 4. El Redireccionador de Raíz (`page.tsx`)

Para mantener la compatibilidad con enlaces antiguos (Legacy), la página raíz del módulo debe procesar los antiguos `searchParams`.

```tsx
export default async function ModulePage({ searchParams }) {
    const { view, sub } = await searchParams;
    if (view === 'orders') redirect('/module/orders');
    // ... otros mapeos
    redirect('/module/default-view');
}
```

## 5. Contrato de las Vistas Hijas (`[view]/page.tsx`)

Las páginas dentro de los directorios de vista (sub-carpetas) tienen un contrato simplificado:

1. **Sin Chrome Propio**: NO deben renderizar `PageHeader`, `Breadcrumbs` ni el wrapper de `LAYOUT_TOKENS.view` (ya provistos por el layout).
2. **Acciones de Toolbar**: Si la vista requiere un botón de creación (ej. "Nuevo Cliente"), debe renderizar el componente `<ToolbarCreateButton />` y, si es necesario, pasarlo como prop `createAction` al componente de feature.
3. **Independencia**: La página es responsable de cargar sus propios datos (o usar Suspense) y manejar sus propios modales mediante `searchParams` (ej. `?modal=new`).

---

## 6. Beneficios del Patrón
- **URLs Semánticas**: `/sales/orders` en lugar de `/sales?view=orders`.
- **Persistencia Visual**: El Header no se re-renderiza al navegar entre sub-vistas del mismo módulo.
- **Desacople**: Las vistas se enfocan en los datos y el contenido, no en la navegación global.
