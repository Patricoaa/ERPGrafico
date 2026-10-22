import { redirect } from "next/navigation"

// "Categorías de Productos" vive ahora como subtab de Configuración
// (/inventory/settings/categories). Ruta conservada como redirector.
export default function ProductsCategoriesPage() {
    redirect("/inventory/settings/categories")
}
