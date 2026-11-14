import * as z from "zod"

/** Configuración de la sincronización automática de ventas TUU (singleton, autosave). */
export const terminalSyncSettingsSchema = z.object({
    enabled: z.boolean(),
    run_hour: z.number().int().min(0, "Entre 0 y 23").max(23, "Entre 0 y 23"),
    lookback_days: z.number().int().min(1, "Entre 1 y 60").max(60, "Entre 1 y 60"),
    history_start_date: z.string().nullable(),
    max_retries: z.number().int().min(0, "Entre 0 y 10").max(10, "Entre 0 y 10"),
    retry_delay_minutes: z.number().int().min(1, "Entre 1 y 120").max(120, "Entre 1 y 120"),
})

export type TerminalSyncSettingsFormValues = z.infer<typeof terminalSyncSettingsSchema>
