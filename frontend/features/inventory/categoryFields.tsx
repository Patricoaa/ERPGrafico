import { createEntityFields } from "@/components/shared"
import type { Category } from "./hooks/useCategories"
import * as LucideIcons from "lucide-react"

export const categoryFields = createEntityFields<Category>()({
    icon: {
        key: "icon",
        type: "computed",
        label: "Icono",
        render: (c) => {
            const iconName = c.icon
            if (!iconName) return <div className="flex justify-center w-full">-</div>
            const Icon = (LucideIcons as unknown as Record<string, React.ElementType>)[iconName] ?? LucideIcons.Package
            return (
                <div className="flex items-center justify-center w-full">
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/30 border border-muted-foreground/10 transition-colors">
                        <Icon className="h-4 w-4 text-muted-foreground/70" />
                    </div>
                </div>
            )
        },
    },
    prefix: {
        key: "prefix",
        type: "text",
        label: "Siglas",
    },
    name: {
        key: "name",
        type: "text",
        label: "Nombre",
    },
    parentName: {
        key: "parent_name",
        type: "secondary",
        label: "Categoría Padre",
    },
})
