"use client"

import React, { useState, useEffect } from "react"
import { ProductCategory } from "@/types/entities"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, LabeledInput, LabeledSelect, LabeledContainer } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormField
} from "@/components/ui/form"
import api from "@/lib/api"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import * as LucideIcons from "lucide-react"
import { Check } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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

function RichIconSelector({ value, onChange, label, error }: { value: string, onChange: (val: string) => void, label?: string, error?: string }) {
    const SelectedIcon = (LucideIcons as any)[value] || LucideIcons.Package
    const selectedLabel = ICON_OPTIONS.find(i => i.name === value)?.label || value

    return (
        <LabeledContainer label={label} error={error}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        role="combobox"
                        className="w-full justify-between h-10 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent font-normal"
                    >
                        <div className="flex items-center gap-2">
                            <SelectedIcon className="h-4 w-4" />
                            <span>{selectedLabel}</span>
                        </div>
                        <LucideIcons.ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                            <LucideIcons.Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
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
    icon: z.string().optional(),
    parent: z.string().optional(),
    asset_account: z.string().optional().nullable(),
    income_account: z.string().optional().nullable(),
    expense_account: z.string().optional().nullable(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormProps {
    auditSidebar?: React.ReactNode
    onSuccess?: (category: ProductCategory) => void
    initialData?: ProductCategory
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerText?: React.ReactNode
}

export function CategoryForm({
    auditSidebar,
    onSuccess,
    initialData,
    open: openProp,
    onOpenChange,
    triggerText = "Nueva Categoría"
}: CategoryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<ProductCategory[]>([])

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: initialData ? {
            ...initialData,
            parent: (initialData.parent as any)?.id?.toString() || initialData.parent?.toString() || "none",
            asset_account: (initialData.asset_account as any)?.id?.toString() || initialData.asset_account?.toString() || "none",
            income_account: (initialData.income_account as any)?.id?.toString() || initialData.income_account?.toString() || "none",
            expense_account: (initialData.expense_account as any)?.id?.toString() || initialData.expense_account?.toString() || "none",
        } : {
            name: "",
        },
    })

    const fetchData = async () => {
        try {
            const [catsRes] = await Promise.all([
                api.get('/inventory/categories/')
            ])
            setCategories(catsRes.data.results || catsRes.data)
        } catch (error) {
            console.error("Error fetching dependencies:", error)
        }
    }

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
                    asset_account: (initialData.asset_account as { id?: number } | undefined)?.id?.toString() || initialData.asset_account?.toString() || "none",
                    income_account: (initialData.income_account as { id?: number } | undefined)?.id?.toString() || initialData.income_account?.toString() || "none",
                    expense_account: (initialData.expense_account as { id?: number } | undefined)?.id?.toString() || initialData.expense_account?.toString() || "none",
                })
            } else {
                form.reset({
                    name: "",
                    prefix: "",
                    parent: "none",
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
        try {
            const payload = {
                ...data,
                parent: (data.parent && data.parent !== "__none__" && data.parent !== "none") ? data.parent : null,
                asset_account: (data.asset_account && data.asset_account !== "__none__" && data.asset_account !== "none") ? data.asset_account : null,
                income_account: (data.income_account && data.income_account !== "__none__" && data.income_account !== "none") ? data.income_account : null,
                expense_account: (data.expense_account && data.expense_account !== "__none__" && data.expense_account !== "none") ? data.expense_account : null,
            }

            let response;
            if (initialData) {
                response = await api.put(`/inventory/categories/${initialData.id}/`, payload)
            } else {
                response = await api.post('/inventory/categories/', payload)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess(response.data)
        } catch (error: unknown) {
            console.error("Error saving category:", error)
        } finally {
            setLoading(false)
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

    return (
        <>
            <Trigger />
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size={initialData ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <LucideIcons.Tag className="h-5 w-5 text-muted-foreground" />
                        <span>{initialData ? "Ficha de Categoría" : "Crear Categoría"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {form.watch("prefix") && (
                            <>
                                <span>{form.watch("prefix")}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("name") || "Nueva Categoría"}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end space-x-2 w-full">
                        <CancelButton onClick={() => setOpen(false)} />
                        <ActionSlideButton type="submit" form="category-form" loading={loading}>
                            {initialData ? "Guardar Cambios" : "Crear Categoría"}
                        </ActionSlideButton>
                    </div>
                }
            >
                <div className="flex-1 flex overflow-hidden min-h-[400px]">
                    <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                        <Form {...form}>
                            <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Información General</span>
                                    </div>

                                    <div className="space-y-6">
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

                                        <div className="grid grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="prefix"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Siglas (Prefijo)"
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
                                                        value={field.value || "Package"}
                                                        onChange={field.onChange}
                                                        error={fieldState.error?.message}
                                                    />
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="parent"
                                            render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Categoría Superior (Jerarquía)"
                                                    value={field.value || "none"}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    placeholder="Sin padre"
                                                    options={[
                                                        { value: "none", label: "Raíz (Sin padre)" },
                                                        ...categories.filter(cat => cat.id && cat.id !== initialData?.id).map((cat) => ({
                                                            value: cat.id.toString(),
                                                            label: cat.name
                                                        }))
                                                    ]}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="relative p-5 pt-8 rounded-lg border-2 bg-muted/5 shadow-sm border-primary/10">
                                    <div className="absolute -top-3 left-4 px-3 bg-background border-2 border-primary/10 rounded-full">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Cuentas Contables por Defecto</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                </div>
                            </form>
                        </Form>
                    </div>

                    {initialData?.id && (
                        <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                            {auditSidebar}
                        </div>
                    )}
                </div>
            </BaseModal>
        </>
    )
}

