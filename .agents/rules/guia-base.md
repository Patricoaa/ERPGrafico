---
trigger: always_on
---

 Instrucciones Persistentes — ERPGrafico Frontend
> Versión 2.0 — Fuente de verdad: `globals.css` + documentos de arquitectura

Copia este bloque completo en tu configuración de "System Instructions" o "User Rules".

---

## 🏛️ Gobernanza y Fuentes de Verdad

### 1. Documentación Maestra (Orden de Consulta Obligatorio)

Antes de generar cualquier código, debes leer y respetar estos documentos en orden:

1. `docs/architecture/GOVERNANCE.md` — La "Constitución": Zero Any, Naming, Modularidad, Feature-Sliced Design.
2. `src/app/globals.css` — **Fuente de verdad visual absoluta.** Tipografía real (Onest + Syne), tokens de color oklch, border-radius industrial (`0.25rem`).
3. `docs/design-system/color-tokens.md` — Mapa de tokens CSS → clases Tailwind → estados de negocio.
4. `docs/architecture/component-contracts.md` — API pública de Shared Components, Hooks y Forms.
5. `docs/architecture/BUSINESS_STATES.md` — Estados de negocio por módulo (fuente de verdad del backend).
6. `docs/architecture/TESTING.md` — Estrategia de pruebas y cobertura mínima requerida.

### 2. Jerarquía de Resolución de Conflictos

Si dos documentos contradicen al respecto de un color, tipografía o token visual:
**`globals.css` siempre gana.** No existe ningún documento con mayor autoridad visual que el CSS real del proyecto.

---

## ⚙️ Reglas de Desarrollo Críticas

### Zero Any
Prohibido usar `any` en TypeScript. Alternativas obligatorias:
- Usar tipos fuertes derivados de Zod schemas.
- Usar `unknown` + type guards cuando la estructura sea incierta.

### Sistema Visual
- **Fuente body:** `font-sans` (Onest). **Fuente headings:** `font-heading` (Syne).
- **Color primario:** violeta eléctrico `oklch(62% 0.244 301)` — clase `text-primary` / `bg-primary`.
- **Border radius:** sharp/industrial (`0.25rem`). No usar `rounded-xl` ni `rounded-full` en componentes de formulario salvo excepción documentada.
- **Nunca** usar colores Tailwind arbitrarios (`bg-red-500`, `text-blue-600`). Solo tokens semánticos de `color-tokens.md`.

### Separación de Capas (Feature-Sliced Design)
- **Lógica de datos** → Hooks de Feature (`use[Entity][Action]` en `src/features/[modulo]/hooks/`).
- **Lógica de validación** → Schemas de Feature (`schema.ts` en `src/features/[modulo]/components/forms/`).
- **Prohibido** importar `@/lib/api` directamente en componentes visuales.
- **Prohibido** importar internals de un feature desde otro feature (usar barrel exports o promover a `/shared`).

### Shared First
- No modificar `/components/ui/` (shadcn base). Ampliar en `/components/shared/` cumpliendo `component-contracts.md`.
- Todo componente shared debe contemplar tres estados: `loading` (Skeleton), `empty` (EmptyState), `error` (Toast via proxy).

### Estados de Negocio
- El mapa canónico de estado → token semántico está en `color-tokens.md`.
- `StatusBadge` es el único componente autorizado para renderizar estados de entidad. No crear badges ad-hoc.

---

## 📁 Estructura de Carpetas

```
src/
├── app/                          # Next.js App Router — solo layout y renderizado de página
│   └── globals.css               # ⚠️ Fuente de verdad visual
├── features/                     # Módulos de negocio
│   ├── sales/
│   ├── inventory/
│   ├── production/
│   ├── purchasing/
│   ├── treasury/
│   ├── accounting/
│   ├── hr/
│   └── contacts/
│   └── [modulo]/
│       ├── components/           # Componentes del módulo
│       │   └── forms/
│       │       └── schema.ts     # Zod schema + Type derivado
│       ├── hooks/                # use[Entity][Action].ts
│       └── index.ts              # Barrel export (contrato público)
├── components/
│   ├── ui/                       # shadcn/ui — NO MODIFICAR
│   └── shared/                   # Componentes promovidos — cumplir component-contracts.md
└── lib/
    └── api/                      # Solo accesible desde hooks de feature
docs/
├── architecture/
│   ├── GOVERNANCE.md
│   ├── TESTING.md
│   ├── BUSINESS_STATES.md
│   ├── component-contracts.md
│   ├── color-tokens.md
│   └── adr/                      # Architecture Decision Records
└── design-system/
    └── pages/                    # Contratos por página (override de color-tokens si existe)
```

---

## ✅ Protocolo de Salida (Checklist Pre-Entrega)

Al finalizar cualquier tarea de código, verifica mentalmente y reporta:

### Checklist de Código
- [ ] ¿Se usó `any` en algún lugar? → Si sí, reemplazar con tipo fuerte o `unknown`.
- [ ] ¿Los colores usan solo tokens de `color-tokens.md`? → No hay `bg-red-500` ni hexadecimales.
- [ ] ¿Los estados de entidad usan el mapa canónico de `color-tokens.md`?
- [ ] ¿Los hooks siguen el patrón `use[Entity][Action]` y retornan `{data, isLoading, error}`?
- [ ] ¿Los formularios tienen `schema.ts` separado con Zod + react-hook-form?
- [ ] ¿Los componentes shared contemplan estados loading / empty / error?
- [ ] ¿No se importó `@/lib/api` directamente en un componente visual?

### Reporte de Entrega
Incluir siempre al final de la respuesta:

```
📦 Entrega
Archivos creados/modificados:
- [lista de archivos con su ruta]

Contratos afectados:
- [componentes o hooks de component-contracts.md que se usaron o modificaron]

¿Requiere nuevo ADR?
- [Sí/No — y si sí, el título propuesto]
```

---

## 🚫 Anti-Patrones Absolutos

| Prohibido | Alternativa |
|-----------|-------------|
| `any` en TypeScript | `unknown` + type guard, o tipo Zod derivado |
| `useQuery` directo en componente UI | Envolver en hook de feature |
| Modificar `/components/ui/` | Extender en `/components/shared/` |
| Importar internals de otro feature | Usar barrel export o promover a `/shared` |
| Badge de estado ad-hoc | `StatusBadge` con `type` y `status` correctos |
| Colores hardcoded en `style={{}}` | Variables CSS via clases Tailwind |
