"use client"

import React, { useState } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FadersHorizontal, WarningCircle, MagnifyingGlass, FloppyDisk } from "@phosphor-icons/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAccountMappings, MappingType } from "@/features/finance/hooks/useAccountMappings"
import { 
    IS_CATEGORIES, 
    CF_CATEGORIES, 
    BS_CATEGORIES, 
    Account 
} from "@/features/accounting/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Tag } from "@phosphor-icons/react"
import { RowSelectionState } from "@tanstack/react-table"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface MappingConfigSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mappingType: MappingType
    onSaveSuccess?: () => void
}

export function MappingConfigSheet({
    open,
    onOpenChange,
    mappingType,
    onSaveSuccess
}: MappingConfigSheetProps) {
    const { 
        accounts, 
        isLoading, 
        isSaving, 
        pendingChanges, 
        updateMapping, 
        saveAll,
        hasChanges
    } = useAccountMappings(mappingType)
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

    const getCategories = () => {
        switch (mappingType) {
            case 'is': return IS_CATEGORIES
            case 'cf': return CF_CATEGORIES
            case 'bs': return BS_CATEGORIES
        }
    }

    const getField = () => {
        switch (mappingType) {
            case 'is': return 'is_category'
            case 'cf': return 'cf_category'
            case 'bs': return 'bs_category'
        }
    }

    const fieldName = getField()

    const getTitle = () => {
        switch (mappingType) {
            case 'is': return "Mapeo Estado de Resultados"
            case 'cf': return "Mapeo Flujo de Caja"
            case 'bs': return "Mapeo Balance General"
        }
    }

    const getSubtitle = () => {
        switch (mappingType) {
            case 'is': return "Asigna cuentas de ingresos y gastos a categorías del EERR"
            case 'cf': return "Asigna flujos operativos, de inversión o financiamiento"
            case 'bs': return "Asigna activos, pasivos y patrimonio a categorías del balance"
        }
    }

    const handleSave = async () => {
        const success = await saveAll()
        if (success) {
            onSaveSuccess?.()
            onOpenChange(false)
        }
    }

    const handleBulkUpdate = (value: string) => {
        const selectedIds = Object.keys(rowSelection).map(idx => accounts[parseInt(idx)].id)
        selectedIds.forEach(id => updateMapping(id, value === "none" ? null : value))
        setRowSelection({})
    }

    const columns: ColumnDef<Account>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    className="translate-y-[2px] border-muted-foreground/30"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    className="translate-y-[2px] border-muted-foreground/30"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "code",
            header: "Código",
            cell: ({ row }) => (
                <div className="font-mono text-[11px] opacity-70 whitespace-nowrap">
                    {row.getValue("code")}
                </div>
            )
        },
        {
            accessorKey: "name",
            header: "Cuenta",
            cell: ({ row }) => (
                <div className="font-black text-[12px] tracking-tight uppercase leading-none max-w-[200px] sm:max-w-[300px] truncate">
                    {row.getValue("name")}
                </div>
            )
        },
        {
            accessorKey: "account_type_display",
            header: "Tipo",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider h-5 rounded-sm bg-muted/30">
                    {row.getValue("account_type_display")}
                </Badge>
            )
        },
        {
            id: "category",
            header: "Categoría Asignada",
            cell: ({ row }) => {
                const account = row.original
                const originalValue = account[fieldName as keyof Account] as string | null
                const pendingValue = pendingChanges.get(account.id)
                const currentValue = pendingValue !== undefined ? pendingValue : originalValue

                const isModified = pendingValue !== undefined

                return (
                    <div className="flex items-center gap-2">
                        {!currentValue && (
                            <WarningCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                        )}
                        <Select 
                            value={currentValue || "none"}
                            onValueChange={(val) => updateMapping(account.id, val)}
                        >
                            <SelectTrigger className={cn(
                                "h-8 text-[11px] font-medium w-[200px]",
                                isModified && "ring-1 ring-primary/50 border-primary/50 bg-primary/5",
                                !currentValue && !isModified && "text-warning border-warning/30 bg-warning/5"
                            )}>
                                <SelectValue placeholder="Sin mapeo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className="text-muted-foreground italic">Sin mapeo</SelectItem>
                                {getCategories().map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )
            }
        }
    ]

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                hideOverlay={true}
                hideCloseButton={true}
                className="h-[85vh] sm:h-[90vh] p-0 border-t-0 bg-background rounded-t-[2.5rem] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.25)] flex flex-col"
            >
                <SheetTitle className="sr-only">Configuración de Mapeo</SheetTitle>
                {/* Visual Handle for "Drawer" feel */}
                <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0 shadow-inner" />

                <SheetCloseButton 
                    onClick={() => onOpenChange(false)}
                    className="absolute top-4 right-8 z-[60]"
                />

                <SheetTitle className="sr-only">{getTitle()}</SheetTitle>

                <div className="px-8 pb-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <FadersHorizontal className="h-5 w-5 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span className="text-xl font-black tracking-tight text-foreground leading-none">{getTitle()}</span>
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60 flex items-center gap-1.5">
                                {getSubtitle()}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] uppercase font-black px-2 py-0.5">
                                Cambios Pendientes ({pendingChanges.size})
                            </Badge>
                        )}
                        <Button 
                            onClick={handleSave} 
                            disabled={!hasChanges || isSaving}
                            className="font-black tracking-widest uppercase text-[10px] h-9"
                        >
                            <FloppyDisk className="mr-2 h-4 w-4" />
                            {isSaving ? "Guardando..." : "Guardar Mapeo"}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-8 flex flex-col min-h-0">
                    <DataTable
                        columns={columns}
                        data={accounts}
                        isLoading={isLoading}
                        cardMode={false}
                        searchPlaceholder="Filtrar por nombre de cuenta..."
                        filterColumn="name"
                        onRowSelectionChange={setRowSelection}
                        useAdvancedFilter={true}
                        batchActions={
                            <div className="flex items-center gap-2">
                                <Select onValueChange={handleBulkUpdate}>
                                    <SelectTrigger className="h-7 bg-white/10 border-white/20 text-white text-[10px] font-black uppercase tracking-widest w-[180px] hover:bg-white/20 transition-colors">
                                        <Tag className="mr-2 h-3.5 w-3.5" />
                                        <SelectValue placeholder="Asignar Categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-muted-foreground italic">Quitar mapeo</SelectItem>
                                        {getCategories().map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        }
                    />
                </div>
            </SheetContent>
        </Sheet>
    )
}
