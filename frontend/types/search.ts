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

/** @deprecated Use TabSegmentDef from @/types/segmentation instead. */
export type EnumFieldDef = {
  key: string
  label: string
  type: 'enum'
  serverParam: string
  options: { label: string; value: string }[]
  defaultValue?: string
}

/** @deprecated Use DateSegmentDef from @/types/segmentation instead. */
export type DateRangeFieldDef = {
  key: string
  label: string
  type: 'daterange'
  serverParamStart: string
  serverParamEnd: string
}

export type FieldDef = TextFieldDef | IdentityEnumFieldDef | EnumFieldDef | DateRangeFieldDef

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
