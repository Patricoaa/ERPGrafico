import { useCallback } from "react"
import Image from "next/image"
import { FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { type ProductFormValues } from "./schema"
import { toast } from "sonner"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

function validateImageFile(file: File): boolean {
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        toast.error("Formato no permitido. Usa JPG, PNG o WEBP.")
        return false
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Tipo MIME inválido. Usa JPG, PNG o WEBP.")
        return false
    }
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
        toast.error("La imagen supera los 10MB.")
        return false
    }
    return true
}

interface ProductImageUploadProps {
    form: UseFormReturn<ProductFormValues>
    imagePreview: string | null
    setImagePreview: (value: string | null) => void
}

export function ProductImageUpload({ form, imagePreview, setImagePreview }: ProductImageUploadProps) {
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, field: any) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!validateImageFile(file)) {
            e.target.value = ""
            return
        }
        field.onChange(file)
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)
    }, [setImagePreview])

    return (
        <div className="h-full">
            <FormField<ProductFormValues>
                control={form.control}
                name="image"
                render={({ field, fieldState }) => (
                    <div className="flex flex-col h-full">
                        <div className="relative group w-full flex-1 rounded-md border-2 border-dashed border-muted-foreground/20 overflow-hidden bg-muted/10 flex items-center justify-center transition-all hover:border-primary/50">
                            {imagePreview ? (
                                <>
                                    <Image
                                        src={imagePreview}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                    <div className="absolute inset-0 bg-overlay/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
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
                                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer p-4 text-center w-full h-full">
                                    <Plus className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">Subir imagen</span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".jpg,.jpeg,.png,.webp"
                                        onChange={(e) => handleFileSelect(e, field)}
                                    />
                                </label>
                            )}
                        </div>
                        {fieldState.error && <p className="text-[10px] text-destructive">{fieldState.error.message}</p>}
                    </div>
                )}
            />
        </div>
    )
}
