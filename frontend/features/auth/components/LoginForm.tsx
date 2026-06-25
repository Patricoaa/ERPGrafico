"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { useAuthLogin } from '../hooks/useAuthLogin'

import {
    Form,
    FormField,
} from "@/components/ui/form"
import { LabeledInput, SubmitButton } from '@/components/shared'

const formSchema = z.object({
    username: z.string().min(2, {
        message: "El nombre de usuario debe tener al menos 2 caracteres.",
    }),
    password: z.string().min(1, {
        message: "La contraseña es obligatoria"
    }),
})

export function LoginForm() {
    const [error, setError] = useState("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })

    const { mutateAsync: loginMutation, isPending: isLoggingIn } = useAuthLogin()

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setError("")
        try {
            await loginMutation(values)
        } catch (err: any) {
            if (err.response?.status === 401) {
                setError("Usuario o contraseña incorrectos")
            } else {
                setError("No se pudo conectar con el servidor. Intente nuevamente.")
            }
        }
    }

    return (
        <div
            className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-3 ease-premium fill-mode-both duration-[600ms] delay-200"
        >
            {/* Form header */}
            <div className="mb-8 text-center">
                <h2 className="font-heading font-black text-2xl uppercase tracking-tighter text-foreground mb-2">
                    Iniciar sesión
                </h2>
                <p className="text-sm text-muted-foreground">
                    Ingresa tus credenciales para acceder al sistema.
                </p>
            </div>

            {/* Form */}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Usuario"
                                placeholder="nombre de usuario"
                                autoComplete="username"
                                autoFocus
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                type="password"
                                label="Contraseña"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />

                    {/* Error message */}
                    {error && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200 fill-mode-both flex items-center gap-2 p-3 rounded-sm bg-destructive/10 border border-destructive/20"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                            <p className="text-xs font-medium text-destructive">{error}</p>
                            </div>
                        )}

                    {/* Submit */}
                    <SubmitButton
                        loading={form.formState.isSubmitting}

                        className="w-full"
                        icon={false}
                    >
                        Ingresar
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </SubmitButton>
                </form>
            </Form>

        </div>
    )
}
