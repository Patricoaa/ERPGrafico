# Análisis de Formularios CRUD y UI/UX

## 1. Desalineamiento Arquitectónico con los Contratos
Se revisaron los contratos principales (`component-form-patterns.md`, `form-layout-architecture.md`, `component-state-sync.md`) y se compararon con implementaciones críticas como `UserDrawer.tsx` y `EmployeeDrawer.tsx`.

*   **Anti-patrón de Sincronización de Estado (Efectos en Cascada):** Los contratos exigen el patrón "Adjust state during render" (ADR-0051) para inicializar el `react-hook-form` y limpiar dependencias en apertura, prohibiendo estrictamente usar `useEffect`. Sin embargo, los formularios actuales utilizan dependencias de `useEffect`, lo cual provoca renders extras, saltos visuales innecesarios, y vulnera las reglas de React Compiler.
*   **Doble Padding y Scrollbars (Problema de Layout):** En `form-layout-architecture.md` se advierte que cuando se usa `FormSplitLayout` como hijo directo de un `Drawer`, se **debe** aplicar la prop `contentClassName="p-0"` al `Drawer`. Los drawers actuales omiten esta prop, inyectando un doble padding (el de Drawer default `px-8 pb-8` más el de `FormSplitLayout`) que desperdicia espacio y potencialmente genera scrollbars anidadas.
*   **Manejo de Tabs en Formularios "Master":** El `EmployeeDrawer` está configurado con `formDrawerWidth("master")`, lo cual es para formularios muy complejos. Según el contrato `component-form-patterns.md`, un formulario "Master" requiere de Tabs en orientación `vertical`. Actualmente `EmployeeDrawer` utiliza tabs horizontales (`orientation="horizontal"`), lo cual para formularios de más de 30 campos o gran densidad dificulta el escalamiento si se agregan más áreas lógicas.

## 2. Oportunidades de Mejora UI/UX (Basado en Skills G-Stack)
Siguiendo las metodologías y directrices de UI engineering y design taste:

*   **Esqueletos vs. Estados Vacíos Visuales:** Ambos formularios utilizan `SkeletonShell`, lo cual está bien conceptualmente. Sin embargo, en UI/UX avanzado de producción, los *skeletons* deben mimetizar exactamente el layout final. Actualmente el shell envuelve globalmente el form, pero podría provocar un brinco del contenido ("layout shift") una vez que carga la API de roles/departamentos.
*   **Densidad y Altura del Drawer:** `EmployeeDrawer` impone un `className="h-[90vh]"` rígido. En lugar de forzar alturas por viewport en el root del componente, las buenas prácticas dictan dejar que el sidebar/form configuren su altura intrínseca adaptativa para que nunca se rompa en resoluciones pequeñas o proporciones inusuales.
*   **Reuso Responsivo:** `TabBarContent` utiliza overflow condicionales como `overflow-y-auto scrollbar-thin`. Si no configuramos bien el padre como `min-h-0`, los contenedores de Tailwind pueden explotar en altura ignorando el viewport visible (ocultando el footer). En `UserDrawer` hay una excesiva anidación de `flex-1 min-h-0` que podría simplificarse.

## 3. Plan de Refactorización Recomendado

1.  **Refactor del Estado (State-Sync):** Reemplazar los `useEffect` de reseteo (tanto en `UserDrawer` como `EmployeeDrawer`) por la mecánica de ref canónica (Variante 4 del contrato de sync):
    ```tsx
    const prevResetKeyRef = useRef<string>("")
    const resetKey = open ? (initialData?.id?.toString() ?? "__new__") : "__closed__"
    if (resetKey !== prevResetKeyRef.current) {
        prevResetKeyRef.current = resetKey
        if (open) form.reset(...)
    }
    ```
2.  **Reparar Layouts y Propagaciones de Padding:** Añadir `contentClassName={initialData?.id ? "p-0" : undefined}` a los modales/drawers que implementan sidebars vía `FormSplitLayout`.
3.  **Modernizar a Tabs Verticales (Sawtooth):** Escalar el `EmployeeDrawer` a tabs verticales para que su jerarquía corresponda a un panel maestro complejo, ofreciendo un mejor espacio lateral para la navegación.
