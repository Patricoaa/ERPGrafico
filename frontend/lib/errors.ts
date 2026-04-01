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
 * Shape of an Axios-like error with response data.
 */
interface AxiosLikeError {
    response?: {
        data?: {
            error?: string
            detail?: string
            message?: string
            [key: string]: unknown
        }
        status?: number
    }
    message?: string
}

/**
 * Type guard for API errors.
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
 * Type guard for Axios-like errors with response data.
 */
function isAxiosLikeError(error: unknown): error is AxiosLikeError {
    return (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as AxiosLikeError).response === "object"
    )
}

/**
 * Extract a user-friendly error message from any error type.
 * Handles: Axios errors, ApiError, native Error, and unknown.
 */
export function getErrorMessage(error: unknown): string {
    // Axios-like errors (most common in this codebase)
    if (isAxiosLikeError(error)) {
        const data = error.response?.data
        if (data) {
            // DRF standard fields
            if (typeof data.error === "string") return data.error
            if (typeof data.detail === "string") return data.detail
            if (typeof data.message === "string") return data.message

            // Field-level validation errors { field: ["msg"] }
            if (typeof data === "object") {
                const fieldErrors = Object.entries(data)
                    .filter(([, v]) => Array.isArray(v))
                    .map(([key, v]) => `${key}: ${(v as string[]).join(", ")}`)
                if (fieldErrors.length > 0) return fieldErrors.join("\n")
            }

            if (typeof data === "string") return data
        }
    }

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
 * Replaces scattered `catch (error: unknown) { toast.error(...) }` patterns.
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
    console.error(fallbackMessage, error)
    const message = getErrorMessage(error)

    if (isApiError(error) && error.errors) {
        const firstFieldErrors = Object.values(error.errors)[0]
        if (firstFieldErrors?.length) {
            toast.error(firstFieldErrors[0])
            return
        }
    }

    toast.error(message || fallbackMessage)
}
