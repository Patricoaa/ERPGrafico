# Reglas de Importación

Este documento establece las políticas obligatorias para la importación de módulos en el proyecto ERPGrafico.

## 1. Importaciones de Componentes Compartidos (Barrel Imports)

Todos los componentes reutilizables en `components/shared/` **DEBEN** ser importados usando el barrel export (`index.ts`).

### ❌ Incorrecto (Path directo)
No se debe apuntar al archivo específico del componente:
```tsx
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
```

### ✅ Correcto (Barrel import)
Se debe apuntar a la raíz del directorio `shared`:
```tsx
import { EmptyState, MoneyDisplay } from '@/components/shared'
```

### ¿Por qué?
1. **Encapsulación**: El barrel define la API pública de los componentes compartidos. Permite ocultar componentes internos auxiliares.
2. **Refactorización**: Si un componente se mueve internamente, los consumidores no se ven afectados mientras el export en `index.ts` se mantenga.
3. **Consistencia**: Unifica la forma de importar utilidades visuales en todo el proyecto.

### Enforcement
Esta regla se aplica automáticamente mediante ESLint usando la regla `import/no-internal-modules`. Violaciones causarán un error en CI/CD y en el pre-commit hook.

```json
"import/no-internal-modules": ["error", {
  "allow": [
    "@/components/shared",
    "@/components/ui/*",
    "@/lib/*",
    "@/hooks/*",
    "@/types/*",
    "@/features/*/index"
  ]
}]
```
