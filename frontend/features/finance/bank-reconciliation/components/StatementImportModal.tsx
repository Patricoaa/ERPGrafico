"use client"

import React, { useState, useEffect, useCallback } from "react"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { getErrorMessage } from "@/lib/errors"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LabeledSelect, GenericWizard, WizardStep, FormSection, DocumentAttachmentDropzone } from "@/components/shared"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { FileUp, Columns, Table as TableIcon, AlertCircle, CheckCircle2, RefreshCw, FileSearch, Landmark, FileText } from "lucide-react"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const importSchema = z.object({
    treasury_account_id: z.string().min(1, "Debes seleccionar una cuenta"),
    bank_format: z.string().min(1, "Debes seleccionar un formato"),
    file: z.any().optional(), // Use any to avoid instanceof issues in Turbopack
    mapping: z.record(z.string(), z.any()).optional()
})

type ImportFormValues = z.infer<typeof importSchema>

interface BankFormat {
    [key: string]: string
}

interface ImportPreviewData {
    columns: Array<string | number>;
    rows: Array<Array<unknown>>;
    file_type: string;
    filename: string;
}

interface StatementImportModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

// Removed Step type as it's handled by GenericWizard

// No longer needed here as it's handled by Zod

export default function StatementImportModal({ open, onOpenChange, onSuccess }: StatementImportModalProps) {

    const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null)
    const [bankFormats, setBankFormats] = useState<BankFormat>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const form = useForm<ImportFormValues>({
        resolver: zodResolver(importSchema) as any,
        defaultValues: {
            treasury_account_id: "",
            bank_format: "GENERIC_CSV",
            file: undefined,
            mapping: {
                date: null,
                description: null,
                debit: null,
                credit: null,
                balance: null,
                reference: null,
                transaction_id: null
            }
        }
    })

    const treasuryAccountId = form.watch("treasury_account_id")
    const bankFormat = form.watch("bank_format")
    const file = form.watch("file")
    const mapping = form.watch("mapping") || {}

    const REQUIRED_FIELDS = ['date', 'description', 'debit', 'credit', 'balance']

    const resetForm = useCallback(() => {
        form.reset()
        setPreviewData(null)
        setError(null)
    }, [form])

    const fetchBankFormats = useCallback(async () => {
        try {
            const response = await api.get('/treasury/statements/formats/')
            setBankFormats(response.data.formats)
        } catch (error) {
            console.error('Error fetching bank formats:', error)
            setBankFormats({
                'GENERIC_CSV': 'CSV Genérico',
                'GENERIC_EXCEL': 'Excel Genérico',
            })
        }
    }, [])

    useEffect(() => {
        if (open) {
            fetchBankFormats()
            resetForm()
        }
    }, [open, resetForm, fetchBankFormats])

    const handleFileChange = (selectedFile: File | null) => {
        if (selectedFile) {
            form.setValue("file", selectedFile)
            setError(null)
        } else {
            form.setValue("file", undefined as any)
        }
    }

    const handlePreview = async () => {
        if (!file) return false
        setLoading(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await api.post('/treasury/statements/preview/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setPreviewData(response.data)

            // Update bank format if it's generic and file type matches excel
            if (response.data.file_type === 'excel' && bankFormat === 'GENERIC_CSV') {
                form.setValue('bank_format', 'GENERIC_EXCEL')
            }

            const cols = response.data.columns
            const newMapping = { ...mapping }
            cols.forEach((col: string | number) => {
                const colStr = String(col).toLowerCase()
                if (colStr.includes('fech') || colStr.includes('date')) newMapping.date = col
                if (colStr.includes('desc') || colStr.includes('glos') || colStr.includes('detalle')) newMapping.description = col
                if (colStr.includes('carg') || colStr.includes('debi')) newMapping.debit = col
                if (colStr.includes('abon') || colStr.includes('cred')) newMapping.credit = col
                if (colStr.includes('sald') || colStr.includes('balan')) newMapping.balance = col
                if (colStr.includes('ref') || colStr.includes('doc')) newMapping.reference = col
            })
            form.setValue('mapping', newMapping)
            return true
        } catch (error: unknown) {
            console.error('Preview error:', error)
            setError("No se pudo generar la vista previa. Revisa el archivo.")
            return false
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        setError(null)

        if (!treasuryAccountId) {
            setError("Selecciona una cuenta de tesorería")
            return false
        }

        // Validate generic mapping
        if (isGenericFormat() && !validateMapping()) {
            setError("Debes mapear todas las columnas obligatorias (Fecha, Descripción, Cargos, Abonos, Saldos)")
            return false
        }

        try {
            setLoading(true)

            const formData = new FormData()
            formData.append('file', file!)
            formData.append('treasury_account_id', treasuryAccountId)
            formData.append('bank_format', bankFormat)

            if (isGenericFormat()) {
                const config = {
                    columns: mapping,
                    header_row: 0,
                    delimiter: bankFormat === 'GENERIC_CSV' ? ';' : undefined
                }
                formData.append('custom_config', JSON.stringify(config))
            }

            await api.post('/treasury/statements/import_statement/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            onSuccess()
            return true
        } catch (error: unknown) {
            console.error('Error importing:', error)
            setError(
                getErrorMessage(error) ||
                'Error al importar la cartola.'
            )
            return false
        } finally {
            setLoading(false)
        }
    }

    const isGenericFormat = () => {
        return bankFormat === 'GENERIC_CSV' || bankFormat === 'GENERIC_EXCEL'
    }

    const validateMapping = () => {
        return REQUIRED_FIELDS.every(field => mapping[field] !== null && mapping[field] !== undefined)
    }

    const handleClose = () => {
        onOpenChange(false)
        setTimeout(resetForm, 300)
    }

    const steps: WizardStep[] = [
        {
            id: 'UPLOAD',
            title: 'Carga de Archivo',
            component: (
                <div className="px-4 pb-4 pt-2 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <FormSection title="Cuenta de Destino" icon={Landmark} />
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                            <TreasuryAccountSelector
                                label="Seleccione la Cuenta Bancaria"
                                value={treasuryAccountId}
                                onChange={(val) => form.setValue("treasury_account_id", val || "")}
                                type="CHECKING"
                            />
                        </div>
                        <div className="col-span-1">
                            <LabeledSelect
                                label="Formato *"
                                value={bankFormat}
                                onChange={(val) => form.setValue("bank_format", val)}
                                options={Object.entries(bankFormats).map(([key, label]) => ({
                                    value: key,
                                    label: label
                                }))}
                            />
                        </div>
                    </div>

                    <FormSection title="Archivo de Cartola" icon={FileUp} />
                    <div className="space-y-6">
                        <DocumentAttachmentDropzone
                            file={file}
                            onFileChange={handleFileChange}
                            accept=".csv,.xls,.xlsx"
                            label="Documento de Cartola"
                        />

                        {error && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <AlertDescription className="text-xs font-bold uppercase text-destructive/80 leading-relaxed">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                    </div>
                </div>
            ),
            isValid: !!treasuryAccountId && !!bankFormat && !!file,
            onNext: async () => {
                if (isGenericFormat()) {
                    return await handlePreview()
                } else {
                    return await handleSubmit()
                }
            }
        },
        ...(isGenericFormat() ? [{
            id: 'MAPPING',
            title: 'Mapeo de Columnas',
            component: (
                <div className="px-4 pb-4 pt-2 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <FormSection title="Mapeo de Columnas" icon={Columns} />

                    <div className="rounded-lg border border-border/40 overflow-hidden bg-background">
                        <div className="max-h-[50vh] overflow-x-auto overflow-y-auto w-full relative custom-scrollbar">
                            {previewData && (
                                <Table className="w-max min-w-full border-separate border-spacing-0">
                                    <TableHeader className="sticky top-0 z-20">
                                        <TableRow className="bg-muted/80 backdrop-blur-md hover:bg-muted/80 border-none">
                                            {previewData.columns.map((col, idx) => (
                                                <TableHead key={idx} className="w-[280px] p-0 border-b border-border/40">
                                                    <div className="flex flex-col gap-3 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded border border-border/40">
                                                                COLUMNA {idx + 1}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-black text-foreground/70 uppercase break-all line-clamp-1 min-h-4" title={String(col)}>
                                                            {String(col)}
                                                        </span>
                                                        <Select
                                                            value={Object.entries(mapping).find((entry) => entry[1] === col)?.[0] || "ignore"}
                                                            onValueChange={(val) => {
                                                                const newMapping = { ...mapping }
                                                                if (val !== 'ignore') {
                                                                    newMapping[val] = col
                                                                } else {
                                                                    const entry = Object.entries(mapping).find((e) => e[1] === col)
                                                                    if (entry) newMapping[entry[0]] = null
                                                                }
                                                                form.setValue("mapping", newMapping)
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs font-bold uppercase bg-background">
                                                                <SelectValue placeholder="Ignorar Columna" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ignore" className="text-xs font-bold uppercase">Ignorar Columna</SelectItem>
                                                                <SelectItem value="date" className="text-xs font-bold uppercase">Fecha Movimiento</SelectItem>
                                                                <SelectItem value="description" className="text-xs font-bold uppercase">Descripción / Glosa</SelectItem>
                                                                <SelectItem value="debit" className="text-xs font-bold uppercase text-destructive">Cargos (Egresos)</SelectItem>
                                                                <SelectItem value="credit" className="text-xs font-bold uppercase text-success">Abonos (Ingresos)</SelectItem>
                                                                <SelectItem value="balance" className="text-xs font-bold uppercase">Saldo</SelectItem>
                                                                <SelectItem value="reference" className="text-xs font-bold uppercase font-mono">Referencia / Doc</SelectItem>
                                                                <SelectItem value="transaction_id" className="text-xs font-bold uppercase font-mono">ID Ext. Transacción</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.rows.slice(0, 8).map((row, rIdx) => (
                                            <TableRow key={rIdx} className="hover:bg-muted/30 transition-colors">
                                                {row.map((cell, cIdx) => (
                                                    <TableCell key={cIdx} className="text-xs py-3 px-4 border-r border-border/30 last:border-r-0 font-medium">
                                                        {String(cell)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>

                    <FormSection title="Estado de Mapeo" icon={TableIcon} />

                    <div className="flex flex-wrap gap-3 items-center justify-center py-2">
                        {REQUIRED_FIELDS.map(f => {
                            const labels: Record<string, string> = {
                                date: 'Fecha',
                                description: 'Descripción',
                                debit: 'Cargos',
                                credit: 'Abonos',
                                balance: 'Saldo'
                            }
                            return (
                                <Badge
                                    key={f}
                                    variant="outline"
                                    className={cn(
                                        "h-6 px-3 text-[10px] font-black uppercase transition-all",
                                        mapping[f] !== null
                                            ? "bg-success/10 border-success/20 text-success shadow-sm shadow-success/5"
                                            : "bg-muted/50 border-border text-muted-foreground/40 line-through"
                                    )}
                                >
                                    {labels[f]} {mapping[f] !== null && '✓'}
                                </Badge>
                            )
                        })}
                    </div>

                    {error && (
                        <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-top-2">
                            <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-xs font-bold uppercase text-destructive/80 leading-relaxed">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>
            ),
            isValid: validateMapping(),
            onNext: async () => {
                return await handleSubmit()
            }
        }] : [])
    ]

    return (
        <GenericWizard
            open={open}
            onOpenChange={handleClose}
            title={
                <div className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-muted-foreground" />
                    <span>Importar Cartola Bancaria</span>
                </div>
            }
            steps={steps}
            onComplete={async () => { }} // Handled in onNext of last step
            size={previewData && isGenericFormat() ? "full" : "lg"}
            contentClassName="p-0"
            isLoading={loading}
            isCompleting={loading}
            successContent={
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <CheckCircle2 className="h-16 w-16 text-success animate-bounce" />
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Importación Exitosa</h3>
                    <p className="text-muted-foreground text-sm font-medium">La cartola ha sido procesada correctamente.</p>
                </div>
            }
        />
    )
}
