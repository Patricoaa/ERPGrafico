"use client"

import { Bug } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Banner, EmptyState, Skeleton, SubmitButton } from "@/components/shared"
import { formatDebugClock } from "@/lib/debug-clock"
import { useDebugClock } from "../hooks/useDebugClock"
import { useDebugToolsAccess } from "../hooks/useDebugToolsAccess"
import { debugClockSchema, type DebugClockFormValues } from "./DebugClockForm.schema"

export function DebugSettingsView() {
    const allowed = useDebugToolsAccess()
    const { clock, isLoading, isError, refetch, setClock, resetClock, isSaving } = useDebugClock(allowed)
    const form = useForm<DebugClockFormValues>({
        resolver: zodResolver(debugClockSchema),
        defaultValues: { datetime: "" },
    })

    if (!allowed) {
        return <EmptyState context="generic" title="Herramientas de depuración no disponibles" variant="compact" />
    }

    if (isLoading) {
        return <Skeleton data-testid="debug-clock-loading" className="h-48 w-full" />
    }

    if (isError || !clock) {
        return (
            <EmptyState
                context="generic"
                title="No se pudo leer el reloj de depuración"
                variant="compact"
                action={<Button type="button" variant="outline" onClick={() => void refetch()}>Reintentar</Button>}
            />
        )
    }

    const onSubmit = async (values: DebugClockFormValues) => {
        try {
            await setClock(values.datetime)
        } catch {
            // El hook ya muestra el error.
        }
    }

    const onReset = async () => {
        try {
            await resetClock()
            form.reset({ datetime: "" })
        } catch {
            // El hook ya muestra el error.
        }
    }

    return (
        <Card className="max-w-xl">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Reloj del servidor</CardTitle>
                </div>
                <CardDescription>
                    Solo desarrollo. Altera la hora de todo el servidor (hora de Santiago); Celery Beat y las APIs externas siguen en hora real. Las sesiones sobreviven a los cambios de hora; si aparece un 401, vuelve a iniciar sesión.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                        <p className="text-sm text-muted-foreground">Hora actual del servidor</p>
                        <p className="text-sm font-medium tabular-nums text-foreground">{formatDebugClock(clock.now)}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{clock.active ? "Reloj alterado" : "Hora real"}</span>
                </div>
                {clock.active && <Banner tone="warning">El reloj del servidor está alterado.</Banner>}
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="datetime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha y hora</FormLabel>
                                    <FormControl>
                                        <Input type="datetime-local" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2">
                            <SubmitButton loading={isSaving}>Fijar hora</SubmitButton>
                            <Button type="button" variant="outline" disabled={isSaving || !clock.active} onClick={() => void onReset()}>
                                Volver a la hora real
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
