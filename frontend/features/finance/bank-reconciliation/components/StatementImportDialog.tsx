"use client"

import { useState, useEffect } from "react"
import { getErrorMessage } from "@/lib/errors"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, ArrowRight } from "lucide-react"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { FORM_STYLES } from "@/lib/styles"

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

    interface ImportPreviewData {
        columns: Array<string | number>;
        rows: Array<Array<unknown>>;
        file_type: string;
        filename: string;
    }

    // Preview Data
    const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null)

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
            // Filter to only show checking accounts as requested
            const checkingAccounts = response.data.filter((acc: TreasuryAccount) => acc.account_type === 'CHECKING')
            setTreasuryAccounts(checkingAccounts)
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
            cols.forEach((col, idx: number) => {
                const colStr = String(col).toLowerCase()
                if (colStr.includes('fech') || colStr.includes('date')) newMapping.date = col
                if (colStr.includes('desc') || colStr.includes('glos') || colStr.includes('detalle')) newMapping.description = col
                if (colStr.includes('carg') || colStr.includes('debi')) newMapping.debit = col
                if (colStr.includes('abon') || colStr.includes('cred')) newMapping.credit = col
                if (colStr.includes('sald') || colStr.includes('balan')) newMapping.balance = col
                if (colStr.includes('ref') || colStr.includes('doc')) newMapping.reference = col
            })
            setMapping(newMapping)

        } catch (error: unknown) {
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

        } catch (error: unknown) {
            console.error('Error importing:', error)
            setError(
                getErrorMessage(error) ||
                'Error al importar la cartola.'
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
        <BaseModal
            open={open}
            onOpenChange={handleClose}
            variant="wizard"
            size={step === 'MAPPING' ? "full" : "lg"}
            title={
                <div className="flex items-center gap-4">
                    <Upload className="h-6 w-6" />
                    <div className="space-y-1">
                        <div className="text-2xl font-black tracking-tight text-foreground/90 uppercase">Importar Cartola</div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider bg-muted/50 border-warning/20 text-warning/80">
                                {step === 'UPLOAD' ? 'Paso 1: Carga' : 'Paso 2: Mapeo'}
                            </Badge>
                            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-widest opacity-70">
                                • Conciliación Bancaria
                            </span>
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button
                        variant="ghost"
                        onClick={step === 'MAPPING' ? () => setStep('UPLOAD') : handleClose}
                        disabled={loading}
                        className="rounded-lg px-6 h-11 text-muted-foreground hover:bg-muted/50 transition-all font-bold uppercase tracking-widest text-[10px]"
                    >
                        {step === 'MAPPING' ? "Atrás" : "Cancelar"}
                    </Button>

                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={handleNext} 
                            disabled={loading || success || (step === 'UPLOAD' && !file)}
                            className={cn(
                                "rounded-lg px-8 h-11 shadow-lg transition-all font-black uppercase tracking-widest text-[10px] group",
                                step === 'UPLOAD' && isGenericFormat() 
                                    ? "bg-primary hover:bg-primary/90 shadow-primary/20" 
                                    : "bg-success hover:bg-success/90 shadow-success/20"
                            )}
                        >
                            {loading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            ) : null}
                            {step === 'UPLOAD' && isGenericFormat() ? (
                                <>
                                    Siguiente
                                    <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                                </>
                            ) : (
                                <>
                                    {success ? "Completado" : "Importar Cartola"}
                                    {!loading && !success && <CheckCircle2 className="ml-2 h-3.5 w-3.5 group-hover:scale-110 transition-transform" />}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                {step === 'UPLOAD' && (
                    <div className="space-y-10 py-4 max-w-xl mx-auto">
                        <div className="p-8 rounded-lg bg-muted/5 border border-border/50 space-y-8">
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Cuenta Corriente de Tesorería *</Label>
                                <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                                    <SelectTrigger className={FORM_STYLES.input}>
                                        <SelectValue placeholder="Selecciona cuenta corriente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {treasuryAccounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{account.code}</span>
                                                    <span className="text-muted-foreground opacity-60">•</span>
                                                    <span>{account.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Formato de Importación *</Label>
                                <Select value={bankFormat} onValueChange={setBankFormat}>
                                    <SelectTrigger className={FORM_STYLES.input}>
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
                                    <div className="flex items-center gap-2 text-[10px] text-info font-bold uppercase tracking-wider mt-2 opacity-80">
                                        <RefreshCw className="w-3 h-3" />
                                        Modo flexible: Se requerirá mapeo manual
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-border/60" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2 px-3">
                                    <FileText className="h-3.5 w-3.5" />
                                    Carga de Archivo
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>

                            <div className="relative group/file">
                                <Input 
                                    type="file" 
                                    onChange={handleFileChange} 
                                    accept=".csv,.xls,.xlsx" 
                                    className={cn(
                                        FORM_STYLES.input, 
                                        "cursor-pointer h-24 border-dashed border-2 hover:border-primary/40 hover:bg-primary/5 transition-all text-center pt-8 file:hidden"
                                    )} 
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-muted-foreground group-hover/file:text-primary transition-colors">
                                    <Upload className="h-6 w-6 mb-2 opacity-50" />
                                    <span className="text-xs font-bold uppercase tracking-widest">
                                        {file ? file.name : "Seleccionar CSV o Excel"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'MAPPING' && previewData && (
                    <div className="space-y-8 max-w-[95vw] mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="rounded-lg border border-border/50 shadow-xl shadow-primary/5 p-1 bg-card overflow-hidden">
                            <div className="max-h-[60vh] overflow-x-auto overflow-y-auto w-full relative custom-scrollbar">
                                <Table className="w-max min-w-full border-separate border-spacing-0">
                                    <TableHeader className="sticky top-0 z-20">
                                        <TableRow className="bg-muted/80 backdrop-blur-md hover:bg-muted/80 border-none">
                                            {previewData.columns.map((col, idx) => (
                                                <TableHead key={idx} className="w-[280px] p-0 border-b border-border/50">
                                                    <div className="flex flex-col gap-3 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full border border-border/50">
                                                                COL {idx + 1}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest break-all line-clamp-1 min-h-4" title={String(col)}>
                                                            {String(col)}
                                                        </span>
                                                        <Select
                                                            value={Object.entries(mapping).find(([_, v]) => v === col)?.[0] || "ignore"}
                                                            onValueChange={(val) => {
                                                                const newMapping = { ...mapping }
                                                                if (val !== 'ignore') {
                                                                    newMapping[val] = col
                                                                } else {
                                                                    const key = Object.entries(mapping).find(([_, v]) => v === col)?.[0]
                                                                    if (key) newMapping[key] = null
                                                                }
                                                                setMapping(newMapping)
                                                            }}
                                                        >
                                                            <SelectTrigger className={cn(FORM_STYLES.input, "h-9 text-[10px] font-bold uppercase tracking-wider bg-background")}>
                                                                <SelectValue placeholder="Ignorar Columna" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ignore" className="text-[10px] font-bold uppercase tracking-wider">Ignorar Columna</SelectItem>
                                                                <SelectItem value="date" className="text-[10px] font-bold uppercase tracking-wider">Fecha Movimiento</SelectItem>
                                                                <SelectItem value="description" className="text-[10px] font-bold uppercase tracking-wider">Descripción / Glosa</SelectItem>
                                                                <SelectItem value="debit" className="text-[10px] font-bold uppercase tracking-wider text-destructive">Cargos (Egresos)</SelectItem>
                                                                <SelectItem value="credit" className="text-[10px] font-bold uppercase tracking-wider text-success">Abonos (Ingresos)</SelectItem>
                                                                <SelectItem value="balance" className="text-[10px] font-bold uppercase tracking-wider">Saldo</SelectItem>
                                                                <SelectItem value="reference" className="text-[10px] font-bold uppercase tracking-wider font-mono">Referencia / Doc</SelectItem>
                                                                <SelectItem value="transaction_id" className="text-[10px] font-bold uppercase tracking-wider font-mono">ID Ext. Transacción</SelectItem>
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
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 items-center justify-center p-4 rounded-lg bg-muted/5 border border-dashed border-border/60">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mr-2">Estado de Mapeo:</span>
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
                                            "h-6 px-3 text-[9px] font-black uppercase tracking-wider transition-all",
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
                    </div>
                )}

                {error && (
                    <div className="max-w-xl mx-auto pt-4 animate-in fade-in slide-in-from-top-2">
                        <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <AlertDescription className="text-xs font-bold uppercase tracking-wider text-destructive/80 leading-relaxed">
                                {error}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {success && (
                    <div className="max-w-xl mx-auto pt-4 animate-in fade-in slide-in-from-top-2">
                        <Alert className="rounded-lg border-success/20 bg-success/5">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <AlertDescription className="text-xs font-black uppercase tracking-[0.2em] text-success">
                                Importación Finalizada con Éxito
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
