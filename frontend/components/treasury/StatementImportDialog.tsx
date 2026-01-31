"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import api from "@/lib/api"

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

export default function StatementImportDialog({ open, onOpenChange, onSuccess }: StatementImportDialogProps) {
    const [file, setFile] = useState<File | null>(null)
    const [treasuryAccountId, setTreasuryAccountId] = useState<string>("")
    const [bankFormat, setBankFormat] = useState<string>("GENERIC_CSV")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])
    const [bankFormats, setBankFormats] = useState<BankFormat>({})

    useEffect(() => {
        if (open) {
            fetchTreasuryAccounts()
            fetchBankFormats()
        }
    }, [open])

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
            // Fallback formats
            setBankFormats({
                'GENERIC_CSV': 'CSV Genérico',
                'BANCO_CHILE_CSV': 'Banco de Chile - CSV',
                'SCOTIABANK_CSV': 'Scotiabank - CSV',
                'BANCO_ESTADO_CSV': 'Banco Estado - CSV'
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)

        if (!file) {
            setError("Por favor selecciona un archivo")
            return
        }

        if (!treasuryAccountId) {
            setError("Por favor selecciona una cuenta de tesorería")
            return
        }

        try {
            setLoading(true)

            const formData = new FormData()
            formData.append('file', file)
            formData.append('treasury_account_id', treasuryAccountId)
            formData.append('bank_format', bankFormat)

            const response = await api.post('/treasury/statements/import_statement/', formData, {
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
            console.error('Error importing statement:', error)
            setError(
                error.response?.data?.error ||
                'Error al importar el extracto. Verifica el formato del archivo.'
            )
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setFile(null)
        setTreasuryAccountId("")
        setBankFormat("GENERIC_CSV")
        setError(null)
        setSuccess(false)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Importar Extracto Bancario</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV con los movimientos bancarios para crear un nuevo extracto
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Treasury Account Select */}
                    <div className="space-y-2">
                        <Label htmlFor="treasury-account">Cuenta de Tesorería *</Label>
                        <Select value={treasuryAccountId} onValueChange={setTreasuryAccountId}>
                            <SelectTrigger id="treasury-account">
                                <SelectValue placeholder="Selecciona una cuenta" />
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

                    {/* Bank Format Select */}
                    <div className="space-y-2">
                        <Label htmlFor="bank-format">Formato del Banco *</Label>
                        <Select value={bankFormat} onValueChange={setBankFormat}>
                            <SelectTrigger id="bank-format">
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
                        <p className="text-xs text-muted-foreground">
                            Selecciona el formato correspondiente a tu banco o usa CSV Genérico
                        </p>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">Archivo CSV *</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                disabled={loading}
                            />
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{file.name}</span>
                                <span className="text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                            </div>
                        )}
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Success Alert */}
                    {success && (
                        <Alert className="bg-green-50 text-green-900 border-green-200">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                                ¡Extracto importado exitosamente!
                            </AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading || success}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Importar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
