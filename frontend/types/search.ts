export type TextFieldDef = {
  key: string
  label: string
  type: 'text'
  serverParam: string
  suggestionsUrl?: string
  /** useClientSearch only: row field(s) to match against. Falls back to `key` if omitted. */
  clientKey?: string | string[]
}

/**
 * Identity enum — for entity-classification fields like contact type (Cliente/Proveedor).
 * NOT for operational state/segmentation (status, dates, etc.).
 */
export type IdentityEnumFieldDef = {
  key: string
  label: string
  type: 'identity-enum'
  serverParam: string
  options: { label: string; value: string }[]
}

export type FieldDef = TextFieldDef | IdentityEnumFieldDef

export type SearchDefinition = {
  fields: FieldDef[]
}

export type ActiveChip = {
  key: string
  label: string
  valueLabel: string
  /** True for the global free-text search param (rendered without prefix, neutral color). */
  isGlobalSearch: boolean
}
