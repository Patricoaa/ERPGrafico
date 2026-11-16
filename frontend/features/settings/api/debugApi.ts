import api from "@/lib/api"

export interface DebugClockState {
    active: boolean
    now: string
    offset_seconds: number
}

export const debugApi = {
    getClock: async (): Promise<DebugClockState> => {
        const { data } = await api.get<DebugClockState>("/core/debug/clock/")
        return data
    },
    setClock: async (datetime: string): Promise<DebugClockState> => {
        const { data } = await api.post<DebugClockState>("/core/debug/clock/", { datetime })
        return data
    },
    resetClock: async (): Promise<void> => {
        await api.delete("/core/debug/clock/")
    },
}
