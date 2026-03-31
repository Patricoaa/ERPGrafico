import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatPlainDate } from "@/lib/utils"

interface DashboardPendingTableProps {
    data: any[]
}

export function DashboardPendingTable({ data }: DashboardPendingTableProps) {
    return (
        <Card className="col-span-4 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pendientes Críticos (Antigüedad &gt; 7 días)</CardTitle>
                <Button variant="ghost" className="text-xs" asChild>
                    <Link href="/treasury/reconciliation/match">Ver Todo <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cuenta</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No hay pendientes críticos. ¡Buen trabajo!
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((line) => (
                                <TableRow key={line.id}>
                                    <TableCell className="font-medium text-xs">
                                        {formatPlainDate(line.date)}
                                        <div className="text-muted-foreground text-[10px]">{line.days_pending} días</div>
                                    </TableCell>
                                    <TableCell className="text-xs">{line.account}</TableCell>
                                    <TableCell className="text-xs truncate max-w-[200px]" title={line.description}>
                                        {line.description}
                                    </TableCell>
                                    <TableCell className={`text-right text-xs font-bold ${line.is_credit ? 'text-emerald-700' : 'text-destructive'}`}>
                                        {line.is_credit ? '+' : '-'}${line.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {line.is_overdue && (
                                            <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/treasury/reconciliation/${line.statement_id}/match`}>
                                                Resolver
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
