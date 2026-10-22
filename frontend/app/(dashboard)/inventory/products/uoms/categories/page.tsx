import { redirect } from "next/navigation"

// "Categorías de Medidas" vive ahora como subtab de Configuración
// (/inventory/settings/measure-categories). Ruta conservada como redirector.
export default function ProductsUoMCategoriesPage() {
    redirect("/inventory/settings/measure-categories")
}
