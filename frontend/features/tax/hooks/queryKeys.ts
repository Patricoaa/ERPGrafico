const TAX_ROOT = ['tax'] as const

export const TAX_KEYS = {
  all: TAX_ROOT,
  periods: {
    all: () => [...TAX_ROOT, 'periods'] as const,
    lists: () => [...TAX_KEYS.periods.all(), 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...TAX_KEYS.periods.lists(), { filters }] as const,
    details: () => [...TAX_KEYS.periods.all(), 'detail'] as const,
    detail: (id: number) => [...TAX_KEYS.periods.details(), id] as const,
    checkClosed: (date: string) => [...TAX_KEYS.periods.all(), 'check-closed', date] as const,
  },
  declarations: {
    all: () => [...TAX_ROOT, 'declarations'] as const,
    lists: () => [...TAX_KEYS.declarations.all(), 'list'] as const,
    list: (params?: Record<string, unknown>) => [...TAX_KEYS.declarations.lists(), { params }] as const,
    details: () => [...TAX_KEYS.declarations.all(), 'detail'] as const,
    detail: (id: number) => [...TAX_KEYS.declarations.details(), id] as const,
    calculate: (year: number, month: number) => [...TAX_KEYS.declarations.all(), 'calculate', year, month] as const,
  },
  f29: {
    all: () => [...TAX_ROOT, 'f29'] as const,
    detail: (id: number) => [...TAX_KEYS.f29.all(), id] as const,
  },
}
