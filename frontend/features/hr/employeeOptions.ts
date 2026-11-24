import type { Employee } from "@/types/hr"

export interface SelectOption { value: string; label: string }

/**
 * Opciones del selector de empleado. `employees` trae solo fichas activas (ADR-0154);
 * al editar un registro cuyo empleado fue archivado se agrega ese empleado para que el
 * selector no quede en blanco (el backend solo rechaza *cambiar* a un archivado).
 */
export function employeeSelectOptions(
    employees: Employee[],
    current?: { employee: number; employee_name?: string } | null,
): SelectOption[] {
    const options = employees.map((e) => ({ value: e.id.toString(), label: e.contact_detail?.name || "" }))
    if (current && !options.some((o) => o.value === current.employee.toString())) {
        options.push({ value: current.employee.toString(), label: `${current.employee_name ?? `#${current.employee}`} (archivado)` })
    }
    return options
}
