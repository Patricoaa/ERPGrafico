export interface JustifyOption {
  value: string
  label: string
}

export const DEFICIT_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)" },
  { value: "TRANSFER", label: "Traspaso (Dinero Enviado)" },
  { value: "PARTNER_WITHDRAWAL", label: "Retiro Socio" },
  { value: "THEFT", label: "Faltante / Robo" },
  { value: "SYSTEM_ERROR", label: "Error de Sistema" },
]

export const SURPLUS_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)" },
  { value: "TIP", label: "Propina" },
  { value: "TRANSFER", label: "Traspaso (Dinero Recibido)" },
  { value: "OTHER_IN", label: "Otro Depósito" },
  { value: "SYSTEM_ERROR", label: "Error de Sistema" },
]

export const CLOSE_DEFICIT_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste" },
  { value: "CASHBACK", label: "Vuelto Incorrecto" },
  { value: "TRANSFER", label: "Traspaso (Dinero retirado)" },
  { value: "PARTNER_WITHDRAWAL", label: "Retiro Socio" },
  { value: "THEFT", label: "Faltante / Robo" },
  { value: "ROUNDING", label: "Redondeo" },
  { value: "SYSTEM_ERROR", label: "Error de Sistema" },
]

export const CLOSE_SURPLUS_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste" },
  { value: "TIP", label: "Propina" },
  { value: "TRANSFER", label: "Traspaso (Dinero ingresado)" },
  { value: "ROUNDING", label: "Redondeo" },
  { value: "SYSTEM_ERROR", label: "Error de Sistema" },
]
