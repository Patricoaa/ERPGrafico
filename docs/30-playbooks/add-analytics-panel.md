---
layer: 30-playbooks
doc: add-analytics-panel
task: "Add analytics panel to DataTable toolbar"
triggers: ["analytics", "chart", "analytics panel", "DataTable analytics"]
preconditions:
  - 20-contracts/component-datatable-views.md
validation:
  - npx tsc --noEmit
  - npm run lint
status: active
owner: frontend-team
last_review: 2026-06-26
---

# Playbook — Add Analytics Panel to DataTable

## When to use

An entity list (DataTable) needs a visual analytics panel with charts, metrics, or summaries accessible from the toolbar.

## Step 1: Create analytics data hook

Create a hook that fetches/derives the data needed for charts:

```tsx
// features/{app}/hooks/useMyAnalyticsData.ts
export function useMyAnalyticsData(
  items: MyEntity[],
  dateRange: { from: string; to: string } | null,
  granularity: Granularity,
) {
  return useMemo(() => {
    // Process items into chart-ready data shapes
    const monthlyVolume = computeMonthlyVolume(items, dateRange, granularity)
    const topSuppliers = computeTopSuppliers(items)
    return { monthlyVolume, topSuppliers }
  }, [items, dateRange, granularity])
}
```

## Step 2: Construct AnalyticsPanelConfig

In the DataTable consumer component:

```tsx
import type { AnalyticsPanelConfig } from '@/components/shared'

const [granularity, setGranularity] = useState<Granularity>("month")
const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)

const analyticsData = useMyAnalyticsData(items, dateRange, granularity)

const analyticsPanel: AnalyticsPanelConfig = useMemo(() => ({
  screen: {
    entityName: "Mi Entidad",
    granularity,
    onGranularityChange: setGranularity,
    dateRange,
    onDateRangeChange: setDateRange,
    tabs: [
      {
        value: "resumen",
        label: "Resumen",
        icon: BarChart3,
        columns: [
          {
            id: "main",
            weight: 2,
            sections: [
              {
                id: "chart-1",
                content: {
                  type: "stat-card",
                  config: {
                    label: "Volumen",
                    variant: "chart",
                    chart: {
                      type: "line-chart",
                      data: analyticsData.monthlyVolume,
                      showLegend: true,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
}), [analyticsData, granularity, dateRange])
```

## Step 3: Pass to DataTable

```tsx
<DataTable
  ...
  analyticsPanel={analyticsPanel}
  ...
/>
```

## Checklist

- [ ] Hook de analytics dedicado (no lógica inline en el componente)
- [ ] `AnalyticsPanelConfig` construido en `useMemo` para evitar re-renders
- [ ] `Granularity`, `dateRange` son estado local del componente
- [ ] Charts usan `StatCard` con `variant="chart"` (no raw chart components)
- [ ] Toolbar button se oculta automáticamente cuando `analyticsPanel` es `undefined`
