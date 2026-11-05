"use client"

import React, { useState, useEffect, useCallback } from "react"
import * as z from "zod"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { getErrorMessage } from "@/lib/errors"
import type { ColumnDef } from "@tanstack/react-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DataCell, DataTable, LabeledSelect, BaseModal, DrawerLayout, FadeIn, FormSection, DocumentAttachmentDropzone, LabeledInput, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { FileUp, Columns, Table as TableIcon, CheckCircle2, FileSearch, Landmark, SlidersHorizontal, Calendar } from "lucide-react"
import { financeApi } from "../../api/financeApi"
import { cn } from "@/lib/utils"
import { Chip } from "@/components/shared"
import ImportPreviewStep, { type DryRunResult } from "./ImportPreviewStep"

const importSchema = z.object({
    treasury_account_id: z.string().min(1, "Debes seleccionar una cuenta"),
    bank_format: z.string().min(1, "Debes seleccionar un formato"),
    statement_month: z.string().min(1, "Debes seleccionar un mes"),
    statement_year: z.string().min(1, "Debes seleccionar un año"),
    file: z.unknown().optional(),
    mapping: z.record(z.string(), z.unknown()).optional()
})

const MONTH_OPTIONS = [
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
]

function buildYearOptions(): Array<{ value: string; label: string }> {
    const current = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => {
        const y = String(current - i)
        return { value: y, label: y }
    })
}

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
    onSuccess?: () => void
    defaultAccountId?: number
    allowedAccountIds?: number[]
}

// No longer needed here as it's handled by Zod

export default function StatementImportModal({ open, onOpenChange, onSuccess, defaultAccountId, allowedAccountIds }: StatementImportModalProps) {

    const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null)
    const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null)
    // S3.7: parse options
    const [csvDelimiter, setCsvDelimiter] = useState<string>('auto')
    const [skipRows, setSkipRows] = useState<number>(0)
    const [skipFooterRows, setSkipFooterRows] = useState<number>(0)
    const [bankFormats, setBankFormats] = useState<BankFormat>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [succeeded, setSucceeded] = useState(false)

    const currentYear = String(new Date().getFullYear())
    const currentMonth = String(new Date().getMonth() + 1)

    const form = useForm<ImportFormValues>({
        resolver: zodResolver(importSchema) as unknown as Resolver<ImportFormValues>,
        defaultValues: {
            treasury_account_id: "",
            bank_format: "GENERIC_CSV",
            statement_month: currentMonth,
            statement_year: currentYear,
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
    const statementMonth = form.watch("statement_month")
    const statementYear = form.watch("statement_year")

    const REQUIRED_FIELDS = ['date', 'description', 'debit', 'credit', 'balance']

    const resetForm = useCallback(() => {
        const now = new Date()
        form.reset({
            treasury_account_id: defaultAccountId ? String(defaultAccountId) : "",
            bank_format: "GENERIC_CSV",
            statement_month: String(now.getMonth() + 1),
            statement_year: String(now.getFullYear()),
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
        })
        setPreviewData(null)
        setDryRunResult(null)
        setCsvDelimiter('auto')
        setSkipRows(0)
        setSkipFooterRows(0)
        setError(null)
        setSidebarCollapsed(false)
        setCurrentStep(0)
        setSucceeded(false)
    }, [form, defaultAccountId])

    const fetchBankFormats = useCallback(async () => {
        try {
            const formatsData = await financeApi.getStatementFormats()
            setBankFormats(((formatsData as Record<string, unknown>).formats as BankFormat))
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
            form.setValue("file", undefined)
        }
    }

    const handlePreview = async () => {
        if (!file) return false
        setLoading(true)
        setError(null)
        try {
            const fData = new FormData()
            fData.append('file', file as Blob)

            const previewResult = await financeApi.previewStatement(fData) as ImportPreviewData
            setPreviewData(previewResult)

            // Update bank format if it's generic and file type matches excel
            if (previewResult.file_type === 'excel' && bankFormat === 'GENERIC_CSV') {
                form.setValue('bank_format', 'GENERIC_EXCEL')
            }

            const cols = previewResult.columns
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

    // S3.7: builds custom_config for both dry_run and import_statement
    const buildCustomConfig = () => {
        if (!isGenericFormat()) return undefined
        return {
            columns: mapping,
            header_row: 0,
            delimiter: bankFormat === 'GENERIC_CSV' ? csvDelimiter : undefined,
            skip_rows: skipRows > 0 ? skipRows : undefined,
            skip_footer_rows: skipFooterRows > 0 ? skipFooterRows : undefined,
        }
    }

    const handleDryRun = async () => {
        if (!treasuryAccountId) {
            setError("Selecciona una cuenta de tesorería")
            return false
        }
        
        if (isGenericFormat() && !validateMapping()) {
            setError("Debes mapear todas las columnas obligatorias")
            return false
        }
        
        if (!file) {
            setError("No hay archivo seleccionado")
            return false
        }
        setLoading(true)
        setError(null)
        try {
            const dryRunData = new FormData()
            dryRunData.append('file', file as Blob)
            dryRunData.append('treasury_account_id', treasuryAccountId)
            dryRunData.append('bank_format', bankFormat)
            if (statementMonth) dryRunData.append('statement_month', statementMonth)
            if (statementYear) dryRunData.append('statement_year', statementYear)

            if (isGenericFormat()) {
                const config = buildCustomConfig()
                dryRunData.append('custom_config', JSON.stringify(config))
            }

            const dryRunResultData = await financeApi.dryRunStatement(dryRunData) as DryRunResult
            setDryRunResult(dryRunResultData)
            return true
        } catch (error: unknown) {
            console.error('Dry run error:', error)
            setError(getErrorMessage(error) || "Error al validar la cartola.")
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

        if (!file) {
            setError("No hay archivo seleccionado")
            return false
        }

        try {
            setLoading(true)

            const importData = new FormData()
            importData.append('file', file as Blob)
            importData.append('treasury_account_id', treasuryAccountId)
            importData.append('bank_format', bankFormat)
            if (statementMonth) importData.append('statement_month', statementMonth)
            if (statementYear) importData.append('statement_year', statementYear)

            if (isGenericFormat()) {
                const config = buildCustomConfig()
                importData.append('custom_config', JSON.stringify(config))
            }

            await financeApi.importStatement(importData)

            onSuccess?.()
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

    const steps = [
        {
            id: 'UPLOAD',
            title: 'Carga de Archivo',
            component: (
                <FadeIn className="px-4 pb-4 pt-2 space-y-6">
                    <FormSection title="Cuenta de Destino" icon={Landmark} />
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3">
                            <TreasuryAccountSelector
                                label="Seleccione la Cuenta Bancaria"
                                value={treasuryAccountId}
                                onChange={(val) => form.setValue("treasury_account_id", val || "")}
                                type="CHECKING"
                                allowedIds={allowedAccountIds}
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

                    <FormSection title="Período de la Cartola" icon={Calendar} />
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledSelect
                            label="Mes *"
                            value={statementMonth}
                            onChange={(val) => form.setValue("statement_month", val)}
                            options={MONTH_OPTIONS}
                        />
                        <LabeledSelect
                            label="Año *"
                            value={statementYear}
                            onChange={(val) => form.setValue("statement_year", val)}
                            options={buildYearOptions()}
                        />
                    </div>

                    <FormSection title="Archivo de Cartola" icon={FileUp} />
                    <div className="space-y-6">
                        <DocumentAttachmentDropzone
                            file={file as File | null}
                            onFileChange={handleFileChange}
                            accept=".csv,.xls,.xlsx"
                            label="Documento de Cartola"
                        />

                        {error && (
                            <FadeIn>
                                <Alert variant="destructive" className="rounded-md">
                                    <AlertDescription className="text-xs font-bold uppercase leading-relaxed">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            </FadeIn>
                        )}
                    </div>
                </FadeIn>
            ),
            isValid: !!treasuryAccountId && !!bankFormat && !!statementMonth && !!statementYear && !!file,
            onNext: async () => {
                if (isGenericFormat()) {
                    return await handlePreview()
                } else {
                    return await handleDryRun()
                }
            }
        },
        ...(isGenericFormat() ? [{
            id: 'MAPPING',
            title: 'Mapeo de Columnas',
            component: (
                <FadeIn className="px-4 pb-4 pt-2 space-y-6">
                    <FormSection title="Mapeo de Columnas" icon={Columns} />

                    {/* S3.7: Parse options */}
                    {bankFormat === 'GENERIC_CSV' && (
                        <div className="rounded-md border border-border/40 bg-muted/20 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-black uppercase text-muted-foreground">Opciones de Parseo</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <LabeledSelect
                                        label="Delimitador"
                                        value={csvDelimiter}
                                        onChange={setCsvDelimiter}
                                        options={[
                                            { value: "auto", label: "Auto-detectar" },
                                            { value: ";", label: "Punto y coma ( ; )" },
                                            { value: ",", label: "Coma ( , )" },
                                            { value: "\\t", label: "Tab ( \\t )" },
                                            { value: "|", label: "Barra ( | )" }
                                        ]}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <LabeledInput
                                        label="Saltar filas inicio"
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={skipRows}
                                        onChange={e => setSkipRows(Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <LabeledInput
                                        label="Saltar filas final"
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={skipFooterRows}
                                        onChange={e => setSkipFooterRows(Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {previewData && (
                        <div className="rounded-md border border-border/40 overflow-hidden bg-background">
                            <DataTable
                                columns={previewData.columns.map<ColumnDef<unknown[]>>((col, idx) => ({
                                    id: `col-${idx}`,
                                    accessorFn: (row) => row?.[idx] ?? null,
                                    header: () => (
                                        <div className="p-2 min-w-[240px]">
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
                                                    <SelectItem value="debit" className="text-xs font-bold uppercase text-expense">Cargos (Egresos)</SelectItem>
                                                    <SelectItem value="credit" className="text-xs font-bold uppercase text-income">Abonos (Ingresos)</SelectItem>
                                                    <SelectItem value="balance" className="text-xs font-bold uppercase">Saldo</SelectItem>
                                                    <SelectItem value="reference" className="text-xs font-bold uppercase font-mono">Referencia / Doc</SelectItem>
                                                    <SelectItem value="transaction_id" className="text-xs font-bold uppercase font-mono">ID Ext. Transacción</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ),
                                    cell: ({ row }) => (
                                        <DataCell.Text className="text-left whitespace-nowrap min-w-[240px] justify-start pl-2">
                                            {String((row.original as Record<number, unknown>)[idx] ?? "")}
                                        </DataCell.Text>
                                    )
                                }))}
                                data={previewData.rows.slice(0, 8) as unknown[][]}
                                variant="minimal"
                                hidePagination
                                noBorder
                            />
                        </div>
                    )}

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
                                <Chip
                                    key={f}
                                    size="sm"
                                    intent={mapping[f] !== null ? "success" : "neutral"}
                                    className={cn(
                                        "h-6 px-3 transition-all",
                                        mapping[f] !== null
                                                    ? "shadow-card shadow-success/5"
                                            : "bg-muted/50 border-border text-muted-foreground/40 line-through"
                                    )}
                                >
                                    {labels[f]} {mapping[f] !== null && '✓'}
                                </Chip>
                            )
                        })}
                    </div>

                    {error && (
                        <FadeIn className="max-w-xl mx-auto">
                            <Alert variant="destructive" className="rounded-md">
                                <AlertDescription className="text-xs font-bold uppercase leading-relaxed">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        </FadeIn>
                    )}
                </FadeIn>
            ),
            isValid: validateMapping(),
            onNext: async () => {
                return await handleDryRun()
            }
        }] : []),
        {
            id: 'PREVIEW',
            title: 'Validación / Vista Previa',
            component: <ImportPreviewStep data={dryRunResult} isLoading={loading} />,
            isValid: dryRunResult?.can_import ?? false,
            onNext: async () => {
                return await handleSubmit()
            }
        }
    ]

    const sidebarSteps: WizardSidebarStep[] = [
        {
            id: 'UPLOAD',
            label: 'Configuración',
            icon: Landmark,
            detail: treasuryAccountId && statementMonth && statementYear
                ? <p className="text-3xs font-semibold">{MONTH_OPTIONS.find(m => m.value === statementMonth)?.label} {statementYear}</p>
                : undefined,
        },
        ...(isGenericFormat() ? [{
            id: 'MAPPING',
            label: 'Mapeo de Columnas',
            icon: Columns,
            detail: validateMapping()
                ? <p className="text-3xs font-semibold">Columnas mapeadas ✓</p>
                : undefined,
        } as WizardSidebarStep] : []),
        {
            id: 'PREVIEW',
            label: 'Validación',
            icon: FileSearch,
        },
    ]

    return (
        <BaseModal
            open={open}
            onOpenChange={handleClose}
            icon={FileSearch}
            title="Importar Cartola Bancaria"
            size="xl"
            className="h-[88vh]"
            hideScrollArea
            footer={
                succeeded ? (
                    <div className="flex justify-end px-6 py-3">
                        <Button size="sm" onClick={handleClose}>Cerrar</Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-6 py-3">
                        <div>
                            {currentStep > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentStep((c) => c - 1)}
                                    disabled={loading}
                                >
                                    ← Atrás
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentStep < steps.length - 1 ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={async () => {
                                        const ok = await steps[currentStep].onNext()
                                        if (ok) setCurrentStep((c) => c + 1)
                                    }}
                                    disabled={!steps[currentStep].isValid || loading}
                                >
                                    {loading ? 'Procesando…' : 'Siguiente →'}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={async () => {
                                        const ok = await steps[currentStep].onNext()
                                        if (ok) setSucceeded(true)
                                    }}
                                    disabled={!steps[currentStep].isValid || loading}
                                >
                                    {loading ? 'Importando…' : 'Importar Cartola'}
                                </Button>
                            )}
                        </div>
                    </div>
                )
            }
        >
            {succeeded ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 h-full">
                    <CheckCircle2 className="h-16 w-16 text-success animate-bounce motion-reduce:animate-none" />
                    <h3 className="text-xl font-black uppercase tracking-widest text-foreground">Importación Exitosa</h3>
                    <p className="text-muted-foreground text-sm font-medium">La cartola ha sido procesada correctamente.</p>
                </div>
            ) : (
                <DrawerLayout
                    leftRailRaw
                    leftRail={
                        <WizardStepsSidebar
                            title="Importación"
                            currentStep={currentStep}
                            steps={sidebarSteps}
                            density="compact"
                            showCounter={false}
                            width="w-52"
                            collapsedWidth="w-14"
                            collapsed={sidebarCollapsed}
                            onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
                            className="shrink-0 border-r border-border/60"
                        />
                    }
                    noPadding
                >
                    {steps[currentStep]?.component}
                </DrawerLayout>
            )}
        </BaseModal>
    )
}
