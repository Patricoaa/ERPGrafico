"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useState } from "react"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

const formSchema = z.object({
    username: z.string().min(2, {
        message: "El nombre de usuario debe tener al menos 2 caracteres.",
    }),
    password: z.string().min(1, {
        message: "La contraseña es obligatoria"
    }),
})

import { useAuth } from "@/contexts/AuthContext"

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()
    const [error, setError] = useState("")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setError("")
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/token/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            })

            if (response.ok) {
                const data = await response.json()
                // Use the context login to fetch user data and update global state
                await login(data.access)
                if (data.refresh) {
                    localStorage.setItem('refresh_token', data.refresh)
                }
                router.push('/')
            } else {
                setError("Credenciales inválidas")
            }
        } catch (err) {
            setError("Algo salió mal, intente nuevamente")
        }
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>ERPGrafico - Iniciar Sesión</CardTitle>
                    <CardDescription>Ingresa tus credenciales para acceder al sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Usuario</FormLabel>
                                        <FormControl>
                                            <Input placeholder="usuario" className={FORM_STYLES.input} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className={FORM_STYLES.label}>Contraseña</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••" className={FORM_STYLES.input} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {error && <p className="text-sm text-red-500">{error}</p>}
                            <Button type="submit" className="w-full">Ingresar</Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
