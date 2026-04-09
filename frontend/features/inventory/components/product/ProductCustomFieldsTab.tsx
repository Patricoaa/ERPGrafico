import { Button } from "@/components/ui/button"
import { Plus, Settings2, Trash2 } from "lucide-react"
import { UseFormReturn, useFieldArray } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"

interface ProductCustomFieldsTabProps {
    form: UseFormReturn<ProductFormValues>
    fieldTemplates: any[]
    onShowTemplateForm: () => void
}

export function ProductCustomFieldsTab({ form, fieldTemplates, onShowTemplateForm }: ProductCustomFieldsTabProps) {
    const { fields: customFields, append: appendCustomField, remove: removeCustomField } = useFieldArray({
        control: form.control,
        name: "product_custom_fields"
    })

    return (
        <TabsContent value="custom" className="mt-0 space-y-8">
            <div className="flex items-end justify-between mb-4">
                <div className="flex-1 space-y-1 mr-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                            <Settings2 className="h-3 w-3" /> Campos Personalizados
                        </span>
                        <div className="flex-1 h-px bg-border" />
                    </div>
                    <p className="text-xs text-muted-foreground">Define atributos adicionales para este producto usando plantillas.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg font-bold gap-2"
                        onClick={onShowTemplateForm}
                    >
                        <Settings2 className="h-4 w-4" /> Gestionar Plantillas
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="rounded-lg font-bold gap-2"
                        onClick={() => appendCustomField({ template: 0, order: customFields.length })}
                    >
                        <Plus className="h-4 w-4" /> Añadir Campo
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[300px]">Plantilla / Grupo de Campos</TableHead>
                            <TableHead className="text-center">Orden</TableHead>
                            <TableHead className="text-right w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customFields.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">
                                    No hay grupos de campos personalizados asignados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            customFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Select
                                            onValueChange={(val) => form.setValue(`product_custom_fields.${index}.template`, Number(val))}
                                            value={form.watch(`product_custom_fields.${index}.template`)?.toString()}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar plantilla" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fieldTemplates.map(t => (
                                                    <SelectItem key={t.id} value={t.id.toString()}>
                                                        {t.name} ({t.fields?.length || 0} campos)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <input
                                            type="number"
                                            className="w-16 h-8 rounded border text-center text-xs"
                                            {...form.register(`product_custom_fields.${index}.order`)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => removeCustomField(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </TabsContent>
    )
}
