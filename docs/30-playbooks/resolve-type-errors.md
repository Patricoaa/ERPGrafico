---
layer: 30-playbooks
doc: resolve-type-errors
task: "Fix TypeScript build or type-checking errors"
triggers: ["type error", "typescript error", "fix types", "zero any"]
preconditions:
  - 90-governance/zero-any-policy.md
  - 10-architecture/frontend-fsd.md
validation:
  - npx tsc --noEmit
forbidden:
  - using `any`
  - using `@ts-ignore` without ADR or comment
status: active
owner: frontend-team
last_review: 2026-04-23
---

# Playbook — Resolver Errores de Tipos (Zero Any)

Este *playbook* detalla las estrategias permitidas para solucionar problemas de tipado estricto en el frontend sin violar la directriz "Zero `any`". Obligatorio tanto para desarrolladores como para agentes de IA.

## When to use

Cuando `npx tsc --noEmit` falle, cuando haya un problema de tipado al compilar o cuando un linter avise del uso prohibido de `any`.

## Estrategias Permitidas

### 1. Inferencia desde Esquemas (Zod)

Cuando la API devuelve datos o cuando interactúas con formularios, los tipos **siempre** deben inferirse desde el esquema Zod y nunca declararse manualmente como `interface` (excepto si extienden props de un componente).

```ts
// ❌ INCORRECTO: Evitar re-declarar
interface SaleOrderData { id: string; status: string; }

// ✅ CORRECTO: Inferir del source of truth
import { z } from "zod";
export const SaleOrderSchema = z.object({ id: z.string(), status: z.string() });
export type SaleOrderData = z.infer<typeof SaleOrderSchema>;
```

### 2. Discrepancias de React Hook Form

Un error muy común ocurre cuando los valores esperados por un componente (ej. Input) no coinciden exactamente con los generados por `react-hook-form` (ej. esperar `number` y recibir `number | undefined`).

**Solución preferida:** Usar valores por defecto al de-estructurar o configurar `defaultValues` en la inicialización del formulario.

```ts
// ✅ CORRECTO: Manejo seguro en el value
<Input 
  value={field.value ?? ""} 
  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} 
/>
```

### 3. El uso de `unknown` en lugar de `any`

Si consumes un objeto cuyo formato es dinámico o incierto, o capturas un error genérico, usa `unknown` y aplica un *Type Guard* (validación en tiempo de ejecución).

```ts
// ❌ INCORRECTO
try { ... } catch (e: any) { alert(e.message) }

// ✅ CORRECTO
try { ... } catch (e: unknown) {
  if (e instanceof Error) alert(e.message)
}
```

### 4. Aserciones Estrictas como último recurso

Cuando estás absolutamente seguro del tipo subyacente y TypeScript no puede inferirlo (por ejemplo, en un cast directo de un tipo genérico que proviene de una librería externa), puedes usar aserciones dobles mediante `unknown`. 

**Requisito:** Cada aserción debe estar precedida por un comentario que explique *por qué* es segura.

```ts
// ❌ INCORRECTO: Evade las protecciones del compilador
const val = data as any as MyInterface;

// ✅ CORRECTO: Documentado y seguro a través de unknown
// Razón: El backend garantiza que esta propiedad auxiliar siempre será Date, pero el genérico la marca como string
const dateVal = data.metadata.date as unknown as Date;
```

### 5. Extendiendo Librerías de Terceros

Si una librería (como Shadcn UI o recharts) exige una prop genérica que es incompatible con tus tipos estrictos locales, envuelve la importación/componente en tu directorio `shared/` proporcionando tu propia interfaz. Nunca modifiques el código base de la librería.

```ts
// components/shared/Chart.tsx
import { BaseChart } from "recharts";
interface StrictChartProps extends Omit<React.ComponentProps<typeof BaseChart>, 'data'> {
  data: Array<MyStrictDataType>;
}
```

## Resumen de Validación

1. ¿El error proviene del formulario? → Revisa `schema.ts`.
2. ¿El error viene de una respuesta API? → Asegura que el hook define el tipo de retorno correctamente.
3. ¿El compilador se queja de `any` explícito o implícito? → Transfórmalo a `unknown` y validalo (`if (typeof x === "string")`).
4. Ejecuta `npx tsc --noEmit` para confirmar la corrección.
