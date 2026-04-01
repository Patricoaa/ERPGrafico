import { toast } from "sonner"

/**
 * Standard API error shape returned by the Django backend.
 */
export interface ApiError {
    message: string
    detail?: string
    errors?: Record<string, string[]>
    status?: number
}

/**
 * Type guard for API errors.
 * Use in catch blocks instead of `catch (error: any)`.
 *
 * @example
 * try { ... } catch (error: unknown) {
 *   showApiError(error)
 * }
 */
export function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as ApiError).message === "string"
    )
}

/**
 * Extract a user-friendly error message from any error type.
 */
export function getErrorMessage(error: unknown): string {
    if (isApiError(error)) {
        return error.detail ?? error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}

/**
 * Unified API error handler for toast notifications.
 * Replaces scattered `catch (error: any) { toast.error(error.message || "...") }` patterns.
 *
 * @example
 * try {
 *   await api.post("/endpoint", data)
 *   toast.success("Guardado exitosamente")
 * } catch (error: unknown) {
 *   showApiError(error, "No se pudo guardar")
 * }
 */
export function showApiError(error: unknown, fallbackMessage = "Ha ocurrido un error"): void {
    const message = getErrorMessage(error)

    if (isApiError(error) && error.errors) {
        // If there are field-level errors, show the first one
        const firstFieldErrors = Object.values(error.errors)[0]
        if (firstFieldErrors?.length) {
            toast.error(firstFieldErrors[0])
            return
        }
    }

    toast.error(message || fallbackMessage)
}
