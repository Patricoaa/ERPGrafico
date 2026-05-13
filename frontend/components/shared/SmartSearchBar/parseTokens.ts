import { z } from 'zod'
import type { SearchDefinition } from '@/types/search'

export type FilterState = Record<string, string>

const optionalString = z.string().optional()
const optionalDate = z.iso.date().optional()

function buildSchema(def: SearchDefinition): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of def.fields) {
    if (field.type === 'daterange') {
      shape[field.serverParamStart] = optionalDate
      shape[field.serverParamEnd] = optionalDate
    } else {
      shape[field.key] = optionalString
    }
  }
  return z.object(shape)
}

// Parses "estado:pagado search:Acme" → { estado: 'pagado', search: 'Acme' }
// Unknown or invalid tokens are silently ignored.
export function parseTokens(input: string, def: SearchDefinition): FilterState {
  const raw: Record<string, string> = {}

  const tokenRegex = /(\w+):([^\s]+)/g
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(input)) !== null) {
    const [, key, value] = match
    raw[key] = decodeURIComponent(value)
  }

  const schema = buildSchema(def)
  const result = schema.safeParse(raw)

  if (!result.success) {
    // Parse field by field, keeping only valid ones
    const partial: FilterState = {}
    for (const field of def.fields) {
      const key = field.type === 'daterange' ? field.serverParamStart : field.key
      const endKey = field.type === 'daterange' ? field.serverParamEnd : null
      const fieldSchema = field.type === 'daterange'
        ? z.object({ [key]: optionalDate, ...(endKey ? { [endKey]: optionalDate } : {}) })
        : z.object({ [key]: optionalString })

      const fieldResult = fieldSchema.safeParse(raw)
      if (fieldResult.success) {
        Object.assign(partial, fieldResult.data)
      }
    }
    return Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined)) as FilterState
  }

  return Object.fromEntries(Object.entries(result.data).filter(([, v]) => v !== undefined)) as FilterState
}

// Converts a FilterState back to "key:value key2:value2" display string
export function filtersToTokenString(filters: FilterState, def: SearchDefinition): string {
  const tokens: string[] = []
  for (const field of def.fields) {
    if (field.type === 'daterange') {
      const start = filters[field.serverParamStart]
      const end = filters[field.serverParamEnd]
      if (start) tokens.push(`${field.key}_desde:${start}`)
      if (end) tokens.push(`${field.key}_hasta:${end}`)
    } else {
      const val = filters[field.key]
      if (val) tokens.push(`${field.key}:${val}`)
    }
  }
  return tokens.join(' ')
}
