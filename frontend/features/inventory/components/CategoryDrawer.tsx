"use client"

import React, { useState, useEffect, useRef } from "react"
import { ProductCategory } from "@/types/entities"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Drawer, CancelButton, LabeledInput, LabeledContainer, FormSection, FormFooter, FormSplitLayout, LabeledSwitch } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormField
} from "@/components/ui/form"
import { useCategoryMutations } from "../hooks/useCategoryMutations"
import { AccountSelector, CategorySelector } from "@/components/selectors"
import * as LucideIcons from "lucide-react"
import { Check, Printer } from "lucide-react"
import { formDrawerWidth } from "@/lib/form-widths"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ActivitySidebar } from "@/features/audit/components"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"

const ICON_OPTIONS = [
    // Imprenta y Diseño
    { name: "Printer", label: "Impresora" },
    { name: "Palette", label: "Diseño/Arte" },
    { name: "PenTool", label: "Vector/Pluma" },
    { name: "Image", label: "Imagen" },
    { name: "Layers", label: "Capas" },
    { name: "Scissors", label: "Corte" },
    { name: "Ruler", label: "Regla/Medida" },
    { name: "Stamp", label: "Sello/Timbre" },
    { name: "FileText", label: "Papelería" },
    { name: "Copy", label: "Fotocopia" },
    { name: "Scan", label: "Escáner" },

    // Editorial y Librería
    { name: "Book", label: "Libro" },
    { name: "BookOpen", label: "Catálogo" },
    { name: "Newspaper", label: "Prensa" },
    { name: "Feather", label: "Escritura" },
    { name: "StickyNote", label: "Notas" },
    { name: "Library", label: "Biblioteca" },

    // Bazar y Hogar
    { name: "ShoppingBag", label: "Bolsa" },
    { name: "Store", label: "Tienda" },
    { name: "Gift", label: "Regalo" },
    { name: "Tag", label: "Etiqueta" },
    { name: "Utensils", label: "Cocina" },
    { name: "Coffee", label: "Café" },
    { name: "Armchair", label: "Mobiliario" },
    { name: "Lightbulb", label: "Iluminación" },
    { name: "Box", label: "Caja" },

    // Higiene y Limpieza
    { name: "Sparkles", label: "Limpieza" },
    { name: "Droplets", label: "Líquidos" },
    { name: "Recycle", label: "Reciclaje" },
    { name: "Trash", label: "Residuos" },
    { name: "SprayCan", label: "Aerosol" },

    // General / Tecnología
    { name: "Package", label: "Paquete" },
    { name: "Truck", label: "Despacho" },
    { name: "Monitor", label: "Pantalla" },
    { name: "Smartphone", label: "Celular" },
    { name: "Laptop", label: "Laptop" },
    { name: "Headphones", label: "Audio" },
    { name: "Keyboard", label: "Periféricos" },
    { name: "Wifi", label: "Internet" },
]

function RichIconSelector({ value, onChange, label, error, required }: { value: string, onChange: (val: string) => void, label?: string, error?: string, required?: boolean }) {
    const SelectedIcon = (LucideIcons as any)[value] || LucideIcons.Package
    const selectedLabel = ICON_OPTIONS.find(i => i.name === value)?.label || value

    return (
        <LabeledContainer label={label} error={error} required={required}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        className="w-full justify-between !h-[1.5rem] !py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent font-normal"
                    >
                        <div className="flex items-center gap-2">
                            <SelectedIcon className="h-4 w-4" />
                            <span>{selectedLabel}</span>
                        </div>
                        <LucideIcons.ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                            <LucideIcons.Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                                className="border-0 shadow-none focus-visible:ring-0 bg-transparent px-0"
                                placeholder="Buscar icono..."
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase()
                                    const inputs = document.querySelectorAll('.icon-item')
                                    inputs.forEach((el) => {
                                        if (el.textContent?.toLowerCase().includes(val)) {
                                            (el as HTMLElement).style.display = 'flex'
                                        } else {
                                            (el as HTMLElement).style.display = 'none'
                                        }
                                    })
                                }}
                            />
                        </div>
                        <div className="h-[250px] overflow-y-auto p-1 grid grid-cols-2 gap-1">
                            {ICON_OPTIONS.map((item) => {
                                const Icon = (LucideIcons as any)[item.name] || LucideIcons.Package
                                const isSelected = value === item.name
                                return (
                                    <div
                                        key={item.name}
                                        className={cn(
                                            "icon-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                            isSelected && "bg-accent"
                                        )}
                                        onClick={() => {
                                            onChange(item.name)
                                            document.body.click()
                                        }}
                                    >
                                        <Icon className="h-4 w-4 shrink-0 mr-2" />
                                        <span className="flex-1 truncate text-xs">{item.label}</span>
                                        {isSelected && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </LabeledContainer>
    )
}

const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    prefix: z.string().max(10, "El prefijo no puede exceder 10 caracteres").optional().nullable(),
    icon: z.string().min(1, "El icono es requerido"),
    parent: z.string().optional(),
    has_custom_accounting: z.boolean().optional(),
    asset_account: z.string().optional().nullable(),
    income_account: z.string().optional().nullable(),
    expense_account: z.string().optional().nullable(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryDrawerProps {
    onSuccess?: (category: ProductCategory) => void
    initialData?: ProductCategory
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerText?: React.ReactNode
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
    mode?: DrawerMode
}

export function CategoryDrawer({
    sidebar,
    onSuccess,
    initialData,
    open: openProp,
    onOpenChange,
    triggerText = "Nueva Categoría",
    inline = false,
    onLoadingChange,
    mode: modeProp,
}: CategoryDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const isView = (modeProp ?? (initialData ? "view" : "create")) === "view"
    const mode: DrawerMode = modeProp ?? (initialData ? "view" : "create")

    const { saveCategory } = useCategoryMutations()
    const [loading, setLoading] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: initialData ? {
            ...initialData,
            parent: (initialData.parent as any)?.id?.toString() || initialData.parent?.toString() || "none",
            has_custom_accounting: !!(initialData.asset_account || initialData.income_account || initialData.expense_account),
            asset_account: (initialData.asset_account as any)?.id?.toString() || initialData.asset_account?.toString() || "none",
            income_account: (initialData.income_account as any)?.id?.toString() || initialData.income_account?.toString() || "none",
            expense_account: (initialData.expense_account as any)?.id?.toString() || initialData.expense_account?.toString() || "none",
        } : {
            name: "",
            has_custom_accounting: false,
        },
    })

    const fetchData = async () => {
        // Dependencies fetched by selectors
    }

    const width = formDrawerWidth("medium", !!initialData?.id)

    const lastResetId = React.useRef<number | undefined>(undefined)
    const wasOpen = React.useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen) {
            fetchData()
        }

        if (isNewOpen || isNewData) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    parent: (initialData.parent as { id?: number } | undefined)?.id?.toString() || initialData.parent?.toString() || "none",
                    has_custom_accounting: !!(initialData.asset_account || initialData.income_account || initialData.expense_account),
                    asset_account: (initialData.asset_account as { id?: number } | undefined)?.id?.toString() || initialData.asset_account?.toString() || "none",
                    income_account: (initialData.income_account as { id?: number } | undefined)?.id?.toString() || initialData.income_account?.toString() || "none",
                    expense_account: (initialData.expense_account as { id?: number } | undefined)?.id?.toString() || initialData.expense_account?.toString() || "none",
                })
            } else {
                form.reset({
                    name: "",
                    prefix: "",
                    parent: "none",
                    has_custom_accounting: false,
                    asset_account: undefined,
                    income_account: undefined,
                    expense_account: undefined,
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, form])

    async function onSubmit(data: CategoryFormValues) {
        setLoading(true)
        if (onLoadingChange) onLoadingChange(true)
        try {
            const payload = {
                ...data,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? data.parent : null,
                asset_account: (data.has_custom_accounting && data.asset_account && data.asset_account !== "__none__" && data.asset_account !== "none") ? data.asset_account : null,
                income_account: (data.has_custom_accounting && data.income_account && data.income_account !== "__none__" && data.income_account !== "none") ? data.income_account : null,
                expense_account: (data.has_custom_accounting && data.expense_account && data.expense_account !== "__none__" && data.expense_account !== "none") ? data.expense_account : null,
            }

            // saveCategory invalida CATEGORIES_KEYS.all (lista + detalle) y
            // emite toast + markLocalMutation desde el hook.
            const response = await saveCategory({ id: initialData?.id ?? null, payload })
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(response)
        } catch (error: unknown) {
            console.error("Error saving category:", error)
        } finally {
            setLoading(false)
            if (onLoadingChange) onLoadingChange(false)
        }
    }

    const Trigger = () => {
        if (openProp !== undefined) return null;
        if (initialData) return null;

        return (
            <Button onClick={() => setOpen(true)}>
                {triggerText}
            </Button>
        )
    }

    const formContent = (
        <FormSplitLayout
            showSidebar={!!initialData?.id}
            sidebar={initialData?.id ? <ActivitySidebar entityId={initialData.id} entityType="category" /> : sidebar}
        >
            <Form {...form}>
                <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-2">
                    <fieldset disabled={isView} className="contents">

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Nombre de Categoría"
                                required
                                placeholder="Ej: Insumos de Impresión"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="prefix"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Siglas"
                                placeholder="Ej: IMP"
                                error={fieldState.error?.message}
                                {...field}
                                value={field.value || ""}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="icon"
                        render={({ field, fieldState }) => (
                            <RichIconSelector
                                label="Icono Visual"
                                required
                                value={field.value || "Package"}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="parent"
                        render={({ field, fieldState }) => (
                            <CategorySelector
                                label="Categoría Superior"
                                icon={<LucideIcons.FolderTree className="h-4 w-4" />}
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                placeholder="Sin padre"
                                showPlusButton={false}
                                excludeId={initialData?.id}
                                allowNone={true}
                                noneLabel="Raíz (Sin padre)"
                            />
                        )}
                    />

                    <FormSection title="Cuentas Contables por Defecto" icon={LucideIcons.Library} />

                    <FormField
                        control={form.control}
                        name="has_custom_accounting"
                        render={({ field }) => (
                            <LabeledSwitch
                                label="Mapeo Contable Personalizado"
                                description={field.value ? "Cuentas específicas para esta categoría." : "Usar configuración contable global."}
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                                icon={<LucideIcons.Calculator className={cn("h-4 w-4 transition-colors", field.value ? "text-primary" : "text-muted-foreground/30")} />}
                                className={cn(field.value ? "bg-primary/5 border-primary/20 shadow-sm" : "border-dashed")}
                            />
                        )}
                    />

                    {form.watch("has_custom_accounting") && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <FormField
                                control={form.control}
                                name="asset_account"
                                render={({ field, fieldState }) => (
                                    <AccountSelector
                                        label="Activo (Inventario)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="ASSET"
                                        placeholder="Cuenta de activo..."
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="income_account"
                                render={({ field, fieldState }) => (
                                    <AccountSelector
                                        label="Ingresos (Ventas)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="INCOME"
                                        placeholder="Cuenta de ingreso..."
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="expense_account"
                                render={({ field, fieldState }) => (
                                    <AccountSelector
                                        label="Gastos (Costo)"
                                        value={field.value}
                                        onChange={field.onChange}
                                        accountType="EXPENSE"
                                        placeholder="Cuenta de gasto..."
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />
                        </div>
                    )}
                </fieldset>
                </form>
            </Form>
        </FormSplitLayout>
    )

    if (inline) {
        return <>{formContent}</>
    }

    const drawerTitle = isView
        ? `Ficha de Categoría${initialData?.id ? ` #${initialData.id}` : ""}`
        : mode === 'create'
            ? "Nueva Categoría"
            : "Editar Categoría"

    return (
        <>
            {!isView && <Trigger />}
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="ProductCategory"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Prefijo:</span>
                            <span>{initialData?.prefix ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                contentClassName="p-0"
                icon={LucideIcons.Tag}
                title={<><span>{drawerTitle}</span>{(mode === 'view' || mode === 'edit') && initialData?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}</>}
                subtitle={
                    form.watch("name")
                        ? `${form.watch("prefix") ? `${form.watch("prefix")} | ` : ""}${form.watch("name")}`
                        : (initialData ? undefined : "Nueva Categoría")
                }

                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="category-form" loading={loading}>
                                    {mode === 'create' ? "Crear Categoría" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                {formContent}
            </Drawer>
        </>
    )
}

