"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Settings, MapPin, Power, PowerOff } from "lucide-react"
import api from "@/lib/api"
import { TerminalFormDialog } from "@/components/settings/TerminalFormDialog"
import { toast } from "sonner"

interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number | null
    default_treasury_account_name?: string
    allowed_treasury_accounts?: any[]  // Will be populated by backend
    allowed_payment_methods: string[]  // Computed
    serial_number: string
    ip_address: string | null
}


export default function TerminalsPage() {
    const [terminals, setTerminals] = useState<Terminal[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null)

    const fetchTerminals = async () => {
        try {
            setLoading(true)
            const res = await api.get('/treasury/pos-terminals/')
            setTerminals(res.data.results || res.data)
        } catch (error) {
            toast.error("Error al cargar terminales")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTerminals()
    }, [])

    const handleEdit = (terminal: Terminal) => {
        setEditingTerminal(terminal)
        setDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingTerminal(null)
        setDialogOpen(true)
    }

    const handleToggleActive = async (terminal: Terminal) => {
        try {
            await api.patch(`/treasury/pos-terminals/${terminal.id}/`, {
                is_active: !terminal.is_active
            })
            toast.success(terminal.is_active ? "Terminal desactivado" : "Terminal activado")
            fetchTerminals()
        } catch (error) {
            toast.error("Error al actualizar terminal")
        }
    }

    const getMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            'CASH': 'Efectivo',
            'CARD': 'Tarjeta',
            'TRANSFER': 'Transferencia'
        }
        return labels[method] || method
    }

    if (loading) {
        return (
            <div className="container py-8">
                <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Cargando terminales...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container py-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Terminales POS</h1>
                    <p className="text-muted-foreground">
                        Configura los terminales de punto de venta y sus métodos de pago
                    </p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Terminal
                </Button>
            </div>

            {terminals.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground mb-4">No hay terminales configurados</p>
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Crear primer terminal
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {terminals.map((terminal) => (
                        <Card key={terminal.id} className={!terminal.is_active ? "opacity-60" : ""}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            {terminal.name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{terminal.code}</code>
                                            {terminal.is_active ? (
                                                <Badge variant="default" className="bg-green-500">
                                                    <Power className="h-3 w-3 mr-1" />
                                                    Activo
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    <PowerOff className="h-3 w-3 mr-1" />
                                                    Inactivo
                                                </Badge>
                                            )}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {terminal.location && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-muted-foreground">{terminal.location}</span>
                                    </div>
                                )}

                                <div className="text-sm">
                                    <p className="font-semibold mb-1">Cuenta de Tesorería:</p>
                                    <p className="text-muted-foreground text-xs">
                                        {terminal.default_treasury_account_name}
                                    </p>
                                </div>

                                <div className="text-sm">
                                    <p className="font-semibold mb-1">Métodos de Pago:</p>
                                    <div className="flex gap-1 flex-wrap">
                                        {terminal.allowed_payment_methods.map(method => (
                                            <Badge key={method} variant="outline" className="text-xs">
                                                {getMethodLabel(method)}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleEdit(terminal)}
                                    >
                                        <Settings className="h-3 w-3 mr-1" />
                                        Editar
                                    </Button>
                                    <Button
                                        variant={terminal.is_active ? "destructive" : "default"}
                                        size="sm"
                                        onClick={() => handleToggleActive(terminal)}
                                    >
                                        {terminal.is_active ? "Desactivar" : "Activar"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <TerminalFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                terminal={editingTerminal}
                onSuccess={fetchTerminals}
            />
        </div>
    )
}
