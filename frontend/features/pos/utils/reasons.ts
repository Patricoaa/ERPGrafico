import type { POSJustifyOptions } from "../types"

export interface JustifyOption {
  value: string
  label: string
  /** Una línea que explica cuándo elegirlo (tarjetas táctiles). */
  description?: string
}

export const DEFICIT_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)", description: "El fondo se contó mal antes; se ajusta al monto real." },
  { value: "TRANSFER", label: "Traspaso (Dinero Enviado)", description: "El efectivo se llevó a otra caja o cuenta." },
  { value: "PARTNER_WITHDRAWAL", label: "Retiro Socio", description: "Un socio retiró efectivo de la caja." },
  { value: "THEFT", label: "Faltante / Robo", description: "Falta dinero sin explicación." },
  { value: "SYSTEM_ERROR", label: "Error de Sistema", description: "El sistema registró un monto equivocado." },
  { value: "OTHER_OUT", label: "Otro egreso", description: "Se pagó un gasto con el efectivo de la caja." },
  { value: "UNKNOWN", label: "Sin explicación", description: "No sabe por qué falta; queda como faltante de caja." },
]

export const SURPLUS_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)", description: "El fondo se contó mal antes; se ajusta al monto real." },
  { value: "TIP", label: "Propina", description: "El excedente son propinas." },
  { value: "TRANSFER", label: "Traspaso (Dinero Recibido)", description: "El efectivo llegó desde otra caja o cuenta." },
  { value: "OTHER_IN", label: "Otro Depósito", description: "Ingresó efectivo por otro motivo." },
  { value: "SYSTEM_ERROR", label: "Error de Sistema", description: "El sistema registró un monto equivocado." },
  { value: "UNKNOWN", label: "Sin explicación", description: "No sabe por qué sobra; queda como sobrante de caja." },
]

export const CLOSE_DEFICIT_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste", description: "Se ajusta el esperado al monto contado." },
  { value: "CASHBACK", label: "Vuelto Incorrecto", description: "Se entregó vuelto de más en alguna venta." },
  { value: "TRANSFER", label: "Traspaso (Dinero retirado)", description: "El efectivo se llevó a otra caja o cuenta." },
  { value: "PARTNER_WITHDRAWAL", label: "Retiro Socio", description: "Un socio retiró efectivo de la caja." },
  { value: "THEFT", label: "Faltante / Robo", description: "Falta dinero sin explicación." },
  { value: "ROUNDING", label: "Redondeo", description: "Diferencias por redondeo de vueltos." },
  { value: "SYSTEM_ERROR", label: "Error de Sistema", description: "El sistema registró un monto equivocado." },
  { value: "OTHER_OUT", label: "Otro egreso", description: "Se pagó un gasto con el efectivo de la caja." },
  { value: "UNKNOWN", label: "Sin explicación", description: "No sabe por qué falta; queda como faltante de caja." },
]

export const CLOSE_SURPLUS_OPTIONS: JustifyOption[] = [
  { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste", description: "Se ajusta el esperado al monto contado." },
  { value: "TIP", label: "Propina", description: "El excedente son propinas." },
  { value: "TRANSFER", label: "Traspaso (Dinero ingresado)", description: "El efectivo llegó desde otra caja o cuenta." },
  { value: "ROUNDING", label: "Redondeo", description: "Diferencias por redondeo de vueltos." },
  { value: "SYSTEM_ERROR", label: "Error de Sistema", description: "El sistema registró un monto equivocado." },
  { value: "OTHER_IN", label: "Otro ingreso", description: "Ingresó efectivo por otro motivo." },
  { value: "UNKNOWN", label: "Sin explicación", description: "No sabe por qué sobra; queda como sobrante de caja." },
]

/**
 * Retiro al cerrar (ADR-0129): el efectivo sale de tesorería con un motivo contable.
 * Distinto del traspaso, que solo mueve el efectivo a otra caja o banco.
 */
export const CLOSE_WITHDRAWAL_OPTIONS: JustifyOption[] = [
  { value: "PARTNER_WITHDRAWAL", label: "Retiro de socio", description: "Un socio se lleva el efectivo; queda en su cuenta de retiros." },
  { value: "OTHER_OUT", label: "Otro egreso", description: "Un gasto pagado con el efectivo de la caja." },
]

/**
 * Deja solo los motivos con cuenta contable configurada (ADR-0128/0130), así toda diferencia queda
 * en la cuenta de su motivo. `direction`: "IN" sobra, "OUT" falta (decide la cuenta genérica de
 * "Sin explicación"). El traspaso no depende de una cuenta contable. Sin datos aún, no ofrece ninguno.
 */
export function availableReasons(
  options: JustifyOption[],
  flags: POSJustifyOptions["reasons"] | undefined,
  direction: "IN" | "OUT" = "OUT",
): JustifyOption[] {
  if (!flags) return []
  return options.filter(o => {
    if (o.value === "TRANSFER") return true
    if (o.value === "UNKNOWN") return !!flags[direction === "IN" ? "UNEXPLAINED_GAIN" : "UNEXPLAINED_LOSS"]
    return !!flags[o.value]
  })
}
