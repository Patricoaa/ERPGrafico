import { useAuth } from "@/contexts/AuthContext"
import { useServerDate } from "@/hooks/useServerDate"

/** Las herramientas de depuración exigen `debug_tools` del servidor y un superusuario. */
export function useDebugToolsAccess(): boolean {
    const { debugTools } = useServerDate()
    const { user } = useAuth()
    return debugTools && user?.is_superuser === true
}

/** Quita la pestaña «Depuración» cuando el usuario no tiene acceso. */
export function visibleSettingsTabs<T extends { value: string }>(tabs: readonly T[], canDebug: boolean): T[] {
    return tabs.filter((tab) => tab.value !== "debug" || canDebug)
}
