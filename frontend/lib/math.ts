/**
 * math.ts
 * 
 * Utilidades para operaciones matemáticas seguras, especialmente útiles
 * para cálculos financieros donde la precisión de punto flotante de JavaScript
 * puede causar errores sutiles (ej. 0.1 + 0.2 === 0.30000000000000004).
 */

const DEFAULT_TOLERANCE = 0.01

/**
 * Comprueba si un valor es cero o está dentro de una tolerancia aceptable (por defecto 0.01 centavos).
 * Útil para comparar diferencias matemáticas que deberían ser 0 pero por flotantes pueden ser 0.0000001
 */
export function isZeroTolerance(value: number, tolerance = DEFAULT_TOLERANCE): boolean {
    return Math.abs(value) <= tolerance
}

/**
 * Resta dos números y redondea el resultado a 2 decimales para evitar
 * problemas de precisión de punto flotante.
 */
export function safeDifference(a: number, b: number): number {
    return Math.round((a - b) * 100) / 100
}

/**
 * Suma un arreglo de números de forma segura, redondeando a 2 decimales
 * en cada paso o al final.
 */
export function safeSum(values: number[]): number {
    const total = values.reduce((acc, val) => acc + val, 0)
    return Math.round(total * 100) / 100
}

/**
 * Parsea un string o número asegurando un float válido con 2 decimales de precisión.
 */
export function safeParseFloat(value: string | number): number {
    if (typeof value === 'number') return Math.round(value * 100) / 100
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return 0
    return Math.round(parsed * 100) / 100
}
