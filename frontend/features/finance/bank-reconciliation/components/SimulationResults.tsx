import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"

export function SimulationResults({ rule }: { rule: any }) {
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const simulate = async () => {
            setLoading(true)
            try {
                // Prepare rule data for backend
                const payload = {
                    ...rule,
                    treasury_account_id: rule.treasury_account?.id
                }
                const response = await api.post('/treasury/reconciliation-rules/simulate/', payload)
                setResults(response.data.results)
            } catch (error) {
                console.error("Simulation error", error)
            } finally {
                setLoading(false)
            }
        }
        simulate()
    }, [rule])

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (results.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                No se encontraron coincidencias con esta configuración en las líneas recientes.
            </div>
        )
    }

    return (
        <div className="max-h-[400px] overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Línea Banco</TableHead>
                        <TableHead>Coincidencia (Pago)</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((res, i) => (
                        <TableRow key={i}>
                            <TableCell className="text-sm">
                                <div className="font-medium">{res.line.description}</div>
                                <div className="text-muted-foreground">
                                    {formatPlainDate(res.line.date)} • ${res.line.amount}
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">
                                <div className="font-medium">{res.payment.partner || 'Sin Contacto'}</div>
                                <div className="text-muted-foreground">
                                    Ref: {res.payment.reference} • ${res.payment.amount}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                                {Math.round(res.score)}%
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
