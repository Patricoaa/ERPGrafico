import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const employeeUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / RUT',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'contract_type', label: 'Tipo contrato', field: 'contract_type' },
    { key: 'department', label: 'Departamento', field: 'department' },
  ],
}

export const absenceUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'employee_name',
      label: 'Empleado',
      serverParam: 'employee_name',
      clientKey: ['employee_name'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'absence_type',
      label: 'Tipo',
      serverParam: 'absence_type',
      options: [
        { label: 'Ausentismo', value: 'AUSENTISMO' },
        { label: 'Licencia Médica', value: 'LICENCIA' },
        { label: 'Permiso sin Goce', value: 'PERMISO_SIN_GOCE' },
        { label: 'Ausencia de Horas', value: 'AUSENCIA_HORAS' },
      ],
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha inicio',
    options: [
      { label: 'Hoy', serverParamFrom: 'start_date_after', serverParamTo: 'start_date_before', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'start_date_after', serverParamTo: 'start_date_before', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'start_date_after', serverParamTo: 'start_date_before', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'start_date_after', serverParamTo: 'start_date_before', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'start_date_after', serverParamTo: 'start_date_before', getValue: thisYear },
    ],
  }],
  groupBy: [
    { key: 'absence_type', label: 'Tipo ausencia', field: 'absence_type' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const payrollUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Empleado',
      serverParam: 'search',
    },
    {
      key: 'period_year',
      label: 'Año',
      serverParam: 'period_year',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Contabilizado', value: 'POSTED' },
      ],
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const salaryAdvanceUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'employee_name',
      label: 'Empleado',
      serverParam: 'employee_name',
      clientKey: ['employee_name'],
    },
    {
      key: 'display_id',
      label: 'N° Anticipo',
      serverParam: 'display_id',
      clientKey: ['display_id'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'is_discounted',
      label: 'Estado',
      serverParam: 'is_discounted',
      options: [
        { label: 'Descontado', value: 'true' },
        { label: 'Pendiente', value: 'false' },
      ],
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
