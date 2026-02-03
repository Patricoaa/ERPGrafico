import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { ProductFormValues } from "./schema"
import { Label } from "@/components/ui/label"

interface ProductImageUploadProps {
    form: UseFormReturn<ProductFormValues>
    imagePreview: string | null
    setImagePreview: (value: string | null) => void
}

export function ProductImageUpload({ form, imagePreview, setImagePreview }: ProductImageUploadProps) {
    return (
        <div className="space-y-2">
            <FormField<ProductFormValues>
                control={form.control}
                name="image"
                render={({ field }) => (
                    <FormItem>
                        <div className="relative group aspect-video rounded-2xl border-2 border-dashed border-muted-foreground/20 overflow-hidden bg-muted/10 flex items-center justify-center transition-all hover:border-primary/50">
                            {imagePreview ? (
                                <>
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="rounded-full"
                                            onClick={() => {
                                                setImagePreview(null)
                                                field.onChange(null)
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <label className="flex flex-col items-center gap-2 cursor-pointer p-4 text-center">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Plus className="h-6 w-6 text-primary" />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">Subir imagen</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                field.onChange(file)
                                                const reader = new FileReader()
                                                reader.onloadend = () => setImagePreview(reader.result as string)
                                                reader.readAsDataURL(file)
                                            }
                                        }}
                                    />
                                </label>
                            )}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    )
}
