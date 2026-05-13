export type TextFieldDef = {
  key: string
  label: string
  type: 'text'
  serverParam: string
  suggestionsUrl?: string
}

export type EnumFieldDef = {
  key: string
  label: string
  type: 'enum'
  serverParam: string
  options: { label: string; value: string }[]
}

export type DateRangeFieldDef = {
  key: string
  label: string
  type: 'daterange'
  serverParamStart: string
  serverParamEnd: string
}

export type FieldDef = TextFieldDef | EnumFieldDef | DateRangeFieldDef

export type SearchDefinition = {
  fields: FieldDef[]
}

export type ActiveChip = {
  key: string
  label: string
  valueLabel: string
}
