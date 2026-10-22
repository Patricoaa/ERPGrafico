---
layer: 20-contracts
doc: component-card
status: active
owner: frontend-team
last_review: 2026-05-21
stability: stable
---

# Card

El componente `Card` es el contenedor lógico principal utilizado para agrupar información relacionada en vistas de detalle, formularios y dashboards del ERP. Es parte del sistema de diseño (shadcn/ui) y garantiza la uniformidad estructural de las tarjetas.
**Status**: active  

> Este contrato cubre el `Card` de **panel**. Para cards interactivas (elegir, abrir, navegar) ver [component-card-family.md](./component-card-family.md).

---

## 1. Composición Estricta

Todo Card debe construirse utilizando los sub-componentes oficiales para garantizar el padding, los gaps y los bordes adecuados. Nunca utilices divs genéricos con clases utilitarias de relleno dentro de un `Card` a menos que sea estrictamente necesario en el `CardContent`.

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

<Card variant="default">
  <CardHeader>
    <CardTitle>Totales del Documento</CardTitle>
    <CardDescription>Resumen de montos y retenciones aplicadas.</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido principal de la tarjeta */}
  </CardContent>
  <CardFooter>
    {/* Acciones, como botones secundarios */}
  </CardFooter>
</Card>
```

---

## 1b. ModuleGrid (navegación de módulos)

`ModuleGrid` es el contenedor autorizado para **grids de navegación entre módulos/secciones** (Dashboard y Settings). Propiedad de ADR-0074.

- Rol `nav` de la [familia de cards](./component-card-family.md) (ADR-0097): item `card-flat` (8px) en fila, sin altura fija. `CardLead` (40px) con el icono, título `cardAnatomy.title`, descripción opcional de una línea y chevron como glifo.
- Cada item es un `<Link>`.
- **v1 sin pill de estado**: nunca inventar un estado por módulo a partir de literales. El tipo `RuntimeStatus` existe en el API del componente para feeds reales futuros (WS/eventos de conexión), no para mapeos estáticos.
- Sin animación local: la entrada de un grid estático la decide un único `<FadeIn>` del consumidor (ADR-0075). Prohibido `animationDelay`/`animate-in` inline por item.

```tsx
<ModuleGrid items={modules} />  // ModuleGridItem[]: { id, label, description?, url, icon, status? }
```

---

## 2. Variantes

El componente `Card` acepta una propiedad `variant` que modifica su apariencia para distintos contextos.

| Variante | Estilos Principales | Uso Sugerido |
|----------|---------------------|--------------|
| `default` | Borde sólido, sombra leve, fondo `bg-card`, esquinas redondeadas estándar (`rounded-md`). | Tarjetas estándar (ej: InvoiceCard, OrderCard, Dashboards). |
| `dashed` | Bordes punteados, fondo tenue, esquinas redondeadas estándar (`rounded-md`). | Secciones de formularios, sub-bloques visuales o contenido destacable donde se desee menor jerarquía visual que una tarjeta estándar. |
| `transparent` | Borde sólido, sin fondo (`bg-transparent`), sin sombra (`shadow-none`), esquinas redondeadas estándar (`rounded-md`). | Vistas de configuración densas (Settings views) o bloques secundarios integrados en layouts complejos. |

> **Nota sobre la familia interactiva/seleccionable (POS):** `ProductCard`, `ChoiceCard` (stacked + light), `ContactCard`, `MfgLineCard`, `VariantSelectorModal`, `SaleOrderProductStep` (líneas), `OriginSelectionStep`, `EntityCard` (entity-view Collection) y `PaymentMethodSelector` **no** usan `Card` directamente. Usan `CardSurface` (en `components/shared/CardSurface.tsx`), que envuelve `Card variant="default"` + `selectableCardClass()` y neutraliza `gap-6/py-6/shadow-card/rounded-md` para aplicar `rounded-sm` (8px) + tokens `cardAnatomy`. Ver ADR-0094, ADR-0095, ADR-0096 y `design-system.md` §2.

---

## 3. Anti-Patrones a Evitar 🚫

### ❌ Prohibido anidar Cards
No coloques un `<Card>` dentro del `<CardContent>` de otro `<Card>`. Si necesitas agrupación secundaria, utiliza `variant="dashed"` de forma aislada o separadores lógicos (`<Separator />`).
```tsx
// MAL
<Card>
  <CardContent>
    <Card>...</Card>
  </CardContent>
</Card>
```

### ❌ Cuidado con tablas complejas sin paginación
No utilices `<Card>` como un simple envoltorio para listas infinitas o `<DataTable>` extremadamente anchas o paginadas a menos que el `Card` actúe como el layout de vista completa de dicha tabla. Considera utilizar los layouts de página en su lugar o aplicar el componente `<DataTable>` sin un wrapper limitante.
