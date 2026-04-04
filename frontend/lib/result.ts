export type Result<T, E = Error> =
    | { ok: true; value: T; error?: never }
    | { ok: false; value?: never; error: E };

export function Ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

export interface ApiError {
    message: string;
    code: string;
    details?: Record<string, any>;
    status_code?: number;
}

export async function wrapApiCall<T>(promise: Promise<any>): Promise<Result<T, ApiError>> {
    try {
        const response = await promise;
        return Ok(response.data as T);
    } catch (error: unknown) {
        if (error.response?.data?.error) {
            return Err(error.response.data.error as ApiError);
        }
        return Err({
            message: error.message || "Ocurrió un error inesperado.",
            code: "UNKNOWN_ERROR",
            status_code: error.response?.status
        });
    }
}
