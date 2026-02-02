"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowRight } from "lucide-react"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

interface TreasuryAccount {
    id: number
    name: string
    code: string
    account_type: string
}

interface BankFormat {
    [key: string]: string
}

interface StatementImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

type Step = 'UPLOAD' | 'MAPPING' | 'CONFIRM'

interface ColumnMapping {
    [key: string]: string | number | null // Field ('date') -> Column Index/Name
}

export default function StatementImportDialog({ open, onOpenChange, onSuccess }: StatementImportDialogProps) {
    const [step, setStep] = useState<Step>('UPLOAD')
    const [file, setFile] = useState<File | null>(null)
    const [treasuryAccountId, setTreasuryAccountId] = useState<string>("")
    const [bankFormat, setBankFormat] = useState<string>("GENERIC_CSV")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])
    const [bankFormats, setBankFormats] = useState<BankFormat>({})

    // Preview Data
    const [previewData, setPreviewData] = useState<{
        columns: Array<string | number>,
        rows: Array<Array<any>>,
        file_type: string,
        filename: string
    } | null>(null)

    // Column Mapping State
    const [mapping, setMapping] = useState<ColumnMapping>({
        date: null,
        description: null,
        debit: null,
        credit: null,
        balance: null,
        reference: null,
        transaction_id: null
    })

    const REQUIRED_FIELDS = ['date', 'description', 'debit', 'credit', 'balance']

    useEffect(() => {
        if (open) {
            fetchTreasuryAccounts()
            fetchBankFormats()
            resetForm()
        }
    }, [open])

    const resetForm = () => {
        setStep('UPLOAD')
        setFile(null)
        setTreasuryAccountId("")
        setBankFormat("GENERIC_CSV")
        setPreviewData(null)
        setMapping({
            date: null,
            description: null,
            debit: null,
            credit: null,
            balance: null,
            reference: null,
            transaction_id: null
        })
        setError(null)
        setSuccess(false)
    }

    const fetchTreasuryAccounts = async () => {
        try {
            const response = await api.get('/treasury/accounts/')
            setTreasuryAccounts(response.data)
        } catch (error) {
            console.error('Error fetching treasury accounts:', error)
        }
    }

    const fetchBankFormats = async () => {
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
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setError(null)
        }
    }

    const handlePreview = async () => {
        if (!file) return
        setLoading(true)
        setError(null)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await api.post('/treasury/statements/preview/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            setPreviewData(response.data)
            setStep('MAPPING')

            // Update bank format if it's generic and file type matches excel
            if (response.data.file_type === 'excel' && bankFormat === 'GENERIC_CSV') {
                setBankFormat('GENERIC_EXCEL')
            }
            const cols = response.data.columns
            const newMapping = { ...mapping }
            cols.forEach((col: any, idx: number) => {
                const colStr = String(col).toLowerCase()
                if (colStr.includes('fech') || colStr.includes('date')) newMapping.date = col
                if (colStr.includes('desc') || colStr.includes('glos') || colStr.includes('detalle')) newMapping.description = col
                if (colStr.includes('carg') || colStr.includes('debi')) newMapping.debit = col
                if (colStr.includes('abon') || colStr.includes('cred')) newMapping.credit = col
                if (colStr.includes('sald') || colStr.includes('balan')) newMapping.balance = col
                if (colStr.includes('ref') || colStr.includes('doc')) newMapping.reference = col
            })
            setMapping(newMapping)

        } catch (error: any) {
            console.error('Preview error:', error)
            setError("No se pudo generar la vista previa. Revisa el archivo.")
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        setError(null)
        setSuccess(false)

        if (!treasuryAccountId) {
            setError("Selecciona una cuenta de tesorería")
            return
        }

        // Validate generic mapping
        if (isGenericFormat() && !validateMapping()) {
            setError("Debes mapear todas las columnas obligatorias (Fecha, Descripción, Cargos, Abonos, Saldos)")
            return
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
                    header_row: 0, // Simplified assumption
                    delimiter: bankFormat === 'GENERIC_CSV' ? ';' : undefined  // Heuristic, backend should auto-detect though
                }
                formData.append('custom_config', JSON.stringify(config))
            }

            await api.post('/treasury/statements/import_statement/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                handleClose()
            }, 1500)

        } catch (error: any) {
            console.error('Error importing:', error)
            setError(
                error.response?.data?.error ||
                'Error al importar el extracto.'
            )
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

    const handleNext = () => {
        if (step === 'UPLOAD') {
            if (!file) {
                setError('Sube un archivo primero')
                return
            }
            if (isGenericFormat()) {
                handlePreview()
            } else {
                handleSubmit() // Direct import for specific formats
            }
        } else if (step === 'MAPPING') {
            handleSubmit()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={cn("transition-all duration-300", step === 'MAPPING' ? "sm:max-w-7xl max-w-[95vw] w-full" : "sm:max-w-[500px]")}>
                <DialogHeader>
                    <DialogTitle>
                        {step === 'MAPPING' ? 'Configurar Columnas' : 'Importar Extracto Bancario'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'MAPPING'
                            ? 'Asigna cada columna de tu archivo a los campos del sistema'
                            : 'Sube tu cartola bancaria para conciliar movimientos'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {step === 'UPLOAD' && (
                        <>
                            <div className="space-y-2">
                                <Label>Cuenta de Tesorería *</Label>
                                <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona cuenta..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {treasuryAccounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name} ({account.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Formato *</Label>
                                <Select value={bankFormat} onValueChange={setBankFormat}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(bankFormats).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isGenericFormat() && (
                                    <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                        <RefreshCw className="w-3 h-3" />
                                        Modo flexible: podrás configurar las columnas manualmente.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Archivo *</Label>
                                <Input type="file" onChange={handleFileChange} accept=".csv,.xls,.xlsx" />
                            </div>
                        </>
                    )}

                    {step === 'MAPPING' && previewData && (
                        <div className="space-y-4">
                            <div className="rounded-md border max-h-[500px] overflow-auto w-full relative">
                                <Table className="table-fixed w-max min-w-full border-separate border-spacing-0">
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            {previewData.columns.map((col, idx) => (
                                                <TableHead key={idx} className="w-[250px] bg-muted/50 border-x p-0">
                                                    <div className="flex flex-col gap-2 p-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                                {idx}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-mono text-muted-foreground break-all line-clamp-1 h-4" title={String(col)}>
                                                            {String(col)}
                                                        </span>
                                                        <Select
                                                            value={Object.entries(mapping).find(([_, v]) => v === col)?.[0] || "ignore"}
                                                            onValueChange={(val) => {
                                                                const newMapping = { ...mapping }
                                                                // Clear previous assignment of this field
                                                                if (val !== 'ignore') {
                                                                    // Remove if assigned elsewhere? Allow duplicates? Usually 1-to-1.
                                                                    // Let's just set it.
                                                                    newMapping[val] = col
                                                                } else {
                                                                    // Find key that has this col and remove it
                                                                    const key = Object.entries(mapping).find(([_, v]) => v === col)?.[0]
                                                                    if (key) newMapping[key] = null
                                                                }
                                                                setMapping(newMapping)
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs">
                                                                <SelectValue placeholder="Ignorar" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ignore">Ignorar</SelectItem>
                                                                <SelectItem value="date">Fecha</SelectItem>
                                                                <SelectItem value="description">Descripción</SelectItem>
                                                                <SelectItem value="debit">Cargos</SelectItem>
                                                                <SelectItem value="credit">Abonos</SelectItem>
                                                                <SelectItem value="balance">Saldo</SelectItem>
                                                                <SelectItem value="reference">Referencia</SelectItem>
                                                                <SelectItem value="transaction_id">ID Transacción</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.rows.slice(0, 5).map((row, rIdx) => (
                                            <TableRow key={rIdx}>
                                                {row.map((cell, cIdx) => (
                                                    <TableCell key={cIdx} className="text-xs whitespace-nowrap">
                                                        {String(cell)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                                <span>Campos:</span>
                                {REQUIRED_FIELDS.map(f => (
                                    <span key={f} className={cn(mapping[f] !== null ? "text-green-600 font-medium" : "text-red-500")}>
                                        {f} {mapping[f] !== null ? '✓' : '✗'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 text-green-900 border-green-200">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>Importación exitosa</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    {step === 'MAPPING' && (
                        <Button variant="outline" onClick={() => setStep('UPLOAD')} disabled={loading}>
                            Atrás
                        </Button>
                    )}
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleNext} disabled={loading || success}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {step === 'UPLOAD' && isGenericFormat() ? 'Siguiente' : 'Importar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
