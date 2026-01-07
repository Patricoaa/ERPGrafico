
import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import * as LucideIcons from "lucide-react"
import { Check } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from "@/components/ui/badge"

const ICON_OPTIONS = [
    { name: "Package", label: "Paquete" },
    { name: "Coffee", label: "Café" },
    { name: "Briefcase", label: "Maletín" },
    { name: "Book", label: "Libro" },
    { name: "Camera", label: "Cámara" },
    { name: "Car", label: "Auto" },
    { name: "Cloud", label: "Nube" },
    { name: "Cpu", label: "CPU" },
    { name: "Gamepad", label: "Juegos" },
    { name: "Gift", label: "Regalo" },
    { name: "HardDrive", label: "Disco Duro" },
    { name: "Headphones", label: "Audífonos" },
    { name: "Home", label: "Casa" },
    { name: "Image", label: "Imagen" },
    { name: "Laptop", label: "Laptop" },
    { name: "LifeBuoy", label: "Salvavidas" },
    { name: "Mail", label: "Correo" },
    { name: "Map", label: "Mapa" },
    { name: "Mic", label: "Micrófono" },
    { name: "Monitor", label: "Monitor" },
    { name: "Music", label: "Música" },
    { name: "Phone", label: "Teléfono" },
    { name: "Printer", label: "Impresora" },
    { name: "Radio", label: "Radio" },
    { name: "Smartphone", label: "Celular" },
    { name: "Speaker", label: "Parlante" },
    { name: "Sun", label: "Sol" },
    { name: "Tablet", label: "Tablet" },
    { name: "Trash", label: "Basura" },
    { name: "Tv", label: "TV" },
    { name: "Watch", label: "Reloj" },
    { name: "Zap", label: "Energía" },
    { name: "Utensils", label: "Utensilios" },
    { name: "Shirt", label: "Ropa" },
]

function RichIconSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const SelectedIcon = (LucideIcons as any)[value] || LucideIcons.Package
    const selectedLabel = ICON_OPTIONS.find(i => i.name === value)?.label || value

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between px-3 h-10">
                    <div className="flex items-center gap-2">
                        <SelectedIcon className="h-4 w-4" />
                        <span>{selectedLabel}</span>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] h-[300px]" align="start">
                <DropdownMenuLabel>Seleccionar Icono</DropdownMenuLabel>
                <div className="h-[250px] overflow-y-auto p-1 grid grid-cols-2 gap-1">
                    {ICON_OPTIONS.map((item) => {
                        const Icon = (LucideIcons as any)[item.name] || LucideIcons.Package
                        const isSelected = value === item.name
                        return (
                            <DropdownMenuItem
                                key={item.name}
                                className={cn(
                                    "flex items-center gap-2 cursor-pointer p-2 rounded-sm",
                                    isSelected && "bg-accent"
                                )}
                                onClick={() => onChange(item.name)}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="flex-1 truncate text-xs">{item.label}</span>
                                {isSelected && <Check className="h-3 w-3 text-primary opacity-100" />}
                            </DropdownMenuItem>
                        )
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    icon: z.string().optional(),
    parent: z.string().optional(),
    asset_account: z.string().optional(),
    income_account: z.string().optional(),
    expense_account: z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function CategoryForm({ onSuccess, initialData, open: openProp, onOpenChange }: CategoryFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])

    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categorySchema),
        defaultValues: initialData ? {
            ...initialData,
            parent: initialData.parent?.toString() || "none",
            asset_account: initialData.asset_account?.toString() || "none",
            income_account: initialData.income_account?.toString() || "none",
            expense_account: initialData.expense_account?.toString() || "none",
        } : {
            name: "",
        },
    })

    const fetchData = async () => {
        try {
            const [catsRes, accsRes] = await Promise.all([
                api.get('/inventory/categories/'),
                api.get('/accounting/accounts/?is_leaf=true')
            ])
            setCategories(catsRes.data.results || catsRes.data)
            setAccounts(accsRes.data.results || accsRes.data)
        } catch (error) {
            console.error("Error fetching dependencies:", error)
        }
    }

    useEffect(() => {
        if (open) fetchData()
    }, [open])

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    parent: initialData.parent?.id?.toString() || initialData.parent?.toString() || "none",
                    asset_account: initialData.asset_account?.id?.toString() || initialData.asset_account?.toString() || "none",
                    income_account: initialData.income_account?.id?.toString() || initialData.income_account?.toString() || "none",
                    expense_account: initialData.expense_account?.id?.toString() || initialData.expense_account?.toString() || "none",
                })
            } else {
                form.reset({
                    name: "",
                    parent: "none",
                    asset_account: "none",
                    income_account: "none",
                    expense_account: "none",
                })
            }
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

            if (initialData) {
                await api.put(`/inventory/categories/${initialData.id}/`, payload)
            } else {
                await api.post('/inventory/categories/', payload)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving category:", error)
            alert(error.response?.data?.detail || "Error al guardar la categoría")
        } finally {
            setLoading(false)
        }
    }

    const assetAccounts = accounts.filter(a => a.account_type === 'ASSET')
    const incomeAccounts = accounts.filter(a => a.account_type === 'INCOME')
    const expenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {openProp === undefined && !initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Categoría</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Categoría" : "Crear Categoría"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la categoría." : "Ingrese los datos de la nueva categoría y sus cuentas contables asociadas."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Insumos" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Icono</FormLabel>
                                    <FormControl>
                                        <RichIconSelector
                                            value={field.value || "Package"}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parent"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría Padre (Opcional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Sin padre" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Sin padre</SelectItem>
                                            {categories.filter(cat => cat.id).map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="asset_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Activo (Inventario)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Ninguna</SelectItem>
                                            {assetAccounts.filter(acc => acc.id).map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="income_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Ingresos (Ventas)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Ninguna</SelectItem>
                                            {incomeAccounts.filter(acc => acc.id).map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="expense_account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta de Gastos (Costo)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar cuenta" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Ninguna</SelectItem>
                                            {expenseAccounts.filter(acc => acc.id).map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Categoría"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
