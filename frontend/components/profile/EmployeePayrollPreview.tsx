"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getEmployeePayrollPreview } from "@/lib/profile/api"
import { Loader2, FileText, AlertCircle } from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PayrollCard } from "@/components/hr/PayrollCard"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmployeePayrollPreviewProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: any
}

export function EmployeePayrollPreview({ payrollId, open, onOpenChange, employee }: EmployeePayrollPreviewProps) {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && payrollId) {
            setLoading(true)
            setError(null)
            getEmployeePayrollPreview(payrollId)
                .then(res => {
                    // Inject employee data if missing or partial
                    if (res && employee) {
                        const enrichedData = {
                            ...res,
                            employee_name: res.employee_name || employee.contact_detail?.name,
                            employee_tax_id: res.employee_tax_id || employee.contact_detail?.tax_id,
                            employee_detail: res.employee_detail || {
                                contact_detail: employee.contact_detail,
                                position: employee.position,
                                department: employee.department
                            }
                        }
                        setData(enrichedData)
                    } else {
                        setData(res)
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch payroll preview", err)
                    setError("No se pudo cargar el detalle de la liquidación.")
                })
                .finally(() => setLoading(false))
        }
    }, [open, payrollId, employee])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Ocultamos el botón de cierre por defecto de shadcn con [&>button]:hidden */}
            <DialogContent size="xl" className="p-0 overflow-visible bg-transparent border-none shadow-none max-w-5xl [&>button]:hidden flex flex-col items-center">
                <div className="relative w-full max-w-4xl">
                    {/* BOTÓN DE CIERRE ÚNICO - Posicionado relativo a la liquidación */}
                    <div className="absolute -top-12 -right-2 z-50">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onOpenChange(false)}
                            className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 border border-white/20 shadow-2xl transition-all"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-24 bg-background/80 backdrop-blur-sm rounded-3xl shadow-2xl">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-24 bg-background rounded-3xl text-destructive gap-4 border shadow-2xl">
                            <AlertCircle className="h-12 w-12" />
                            <p className="text-lg font-bold">{error}</p>
                        </div>
                    ) : data ? (
                        <ScrollArea className="h-[90vh] w-full rounded-3xl custom-scrollbar border-none">
                            <div className="py-6 px-2">
                                <PayrollCard 
                                    payroll={data}
                                    isPosted={data.status === 'POSTED'}
                                    isReadOnly={true}
                                    showEmployerContributions={false}
                                    payments={data.payments}
                                    className="w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                                />
                            </div>
                        </ScrollArea>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
