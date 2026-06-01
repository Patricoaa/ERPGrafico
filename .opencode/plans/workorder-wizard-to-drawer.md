# Plan: Migración WorkOrderWizard de BaseModal a Drawer

## Objetivo
Convertir el WorkOrderWizard (modal full-screen) en un Drawer lateral izquierdo que preserve el contexto de la página subyacente (lista de OTs).

## Análisis Actual

### Componente Actual
- **Superficie:** `BaseModal` con `size="2xl"` y `className="h-[90vh]"`
- **Layout:** 3 columnas (sidebar 256px + center flex + right sidebar 320px)
- **Header:** Custom `WizardHeader` renderizado via prop `title`
- **Footer:** `WizardStickyFooter` renderizado dentro del contenido

### Propiedades del Drawer a usar
```tsx
<Drawer
  side="left"
  defaultSize="90%"
  boundary="screen"
  resizable
  contentClassName="p-0"
  footer={<WizardStickyFooter ... />}
>
```

## Archivos a Modificar

### 1. `WorkOrderWizard.tsx` (Principal)
**Cambios:**
- Reimportar: `BaseModal` → `Drawer`
- Reemplazar `<BaseModal>` por `<Drawer>` con props:
  - `side="left"`
  - `defaultSize="90%"`
  - `boundary="screen"`
  - `resizable`
  - `contentClassName="p-0"`
  - `title` → usar title prop del Drawer con contenido de WizardHeader
  - `footer` → mover WizardStickyFooter aquí
- Ajustar layout interno: el div flex-1 ya no necesita `h-full` explícito
- Mantener modales hijos (PO Preview, Confirm modals) como BaseModal independientes

**Estructura resultante:**
```tsx
<Drawer
  open={open}
  onOpenChange={onOpenChange}
  side="left"
  defaultSize="90%"
  boundary="screen"
  resizable
  contentClassName="p-0"
  title={
    <WizardHeader
      order={order}
      currentStageLabel={STAGES[viewingStepIndex]?.label}
      // ... resto de props
    />
  }
  footer={
    <WizardStickyFooter
      // ... todas las props actuales
    />
  }
>
  <div className="flex flex-1 overflow-hidden h-full min-h-0">
    <WizardProcessSidebar ... />
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* contenido central sin footer */}
    </div>
    {order && <WizardRightSidebar ... />}
  </div>
</Drawer>
```

### 2. `WizardHeader.tsx`
**Cambios:**
- El componente actual ya es compatible (solo renderiza contenido)
- Ajustar padding: agregar `px-6 py-4` al contenedor para alinearse con el drawer header
- Asegurar que el ancho funcione dentro del slot `title` del Drawer

### 3. `WizardProcessSidebar.tsx`
**Cambios:**
- Ya tiene `w-64` fijo - funciona bien dentro del drawer
- Ajustar padding: cambiar `p-4` a `py-4 pl-4 pr-2` para mejor ajuste
- Verificar que `overflow-y-auto` funcione correctamente

### 4. `WizardRightSidebar.tsx`
**Cambios:**
- Ya tiene `hidden lg:flex` para responsive - funciona bien
- Ajustar `w-80` a `w-72` para dar más espacio al centro en pantallas pequeñas
- Verificar que el border-left se vea correcto en el drawer

### 5. `WizardStickyFooter.tsx`
**Cambios:**
- Ya tiene `sticky bottom-0` - funciona dentro del footer slot del Drawer
- Ajustar padding: cambiar `px-6` a `px-8` para alinearse con el drawer content
- El border-top ya existe, es compatible con el footer del Drawer

## Pasos de Implementación

1. **Modificar `WorkOrderWizard.tsx`**
   - Cambiar import de `BaseModal` a `Drawer`
   - Reemplazar JSX de BaseModal por Drawer
   - Mover WizardStickyFooter a prop `footer`
   - Ajustar layout interno

2. **Ajustar `WizardHeader.tsx`**
   - Agregar padding interno para alineación

3. **Ajustar `WizardProcessSidebar.tsx`**
   - Modificar padding para mejor ajuste

4. **Ajustar `WizardRightSidebar.tsx`**
   - Reducir ancho de `w-80` a `w-72`

5. **Ajustar `WizardStickyFooter.tsx`**
   - Modificar padding para alineación con drawer

6. **Verificar modales hijos**
   - Los BaseModal de PO Preview, Confirm modals, Save template, Cheatsheet funcionan independientemente

## Consideraciones Técnicas

### Responsive
- En pantallas < 1280px: WizardRightSidebar ya se oculta (`hidden lg:flex`)
- En mobile: el drawer a 90% se siente casi full-screen
- El WizardProcessSidebar tiene `hidden md:block` para mobile

### Keyboard Navigation
- El listener global de `keydown` funciona igual (Escape, Ctrl+Arrow, ?)
- No hay conflicto con el Drawer

### URL State
- La sincronización de `?selected`, `?step` funciona igual
- El drawer se integra con el entity drawer registry existente

### Animaciones
- framer-motion `AnimatePresence` funciona dentro del Drawer
- Las animaciones del Drawer (slide) son independientes

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Layout roto en 1366px | Testear en laptop estándar; WizardRightSidebar ya es responsive |
| Padding inconsistente | Usar `contentClassName="p-0"` y controlar padding manualmente |
| Footer slot del Drawer | Verificar que `footerClassName` no agregue estilos no deseados |
| Z-index de modales hijos | Drawer y Dialog coexisten correctamente (z-index management de Radix) |

## Criterios de Aceptación

- [ ] El wizard abre como drawer lateral izquierdo al 90% del viewport
- [ ] El layout de 3 columnas funciona correctamente
- [ ] El header muestra información de la OT
- [ ] El sidebar de etapas funciona con governance
- [ ] El footer muestra acciones contextuales
- [ ] El right sidebar se oculta en pantallas < 1280px
- [ ] Los modales hijos (PO Preview, Confirm) funcionan correctamente
- [ ] La navegación por teclado funciona (Escape, Ctrl+Arrow)
- [ ] El state sync con URL funciona
- [ ] `npm run type-check` pasa sin errores
- [ ] `npm run lint` pasa sin errores
