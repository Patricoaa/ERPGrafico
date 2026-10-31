import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ForbiddenPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
            <h1 className="text-3xl font-bold text-foreground">Sin acceso</h1>
            <p className="text-muted-foreground max-w-md">
                No tienes permiso para ver este módulo. Contacta a un administrador del sistema.
            </p>
            <Button asChild>
                <Link href="/">Volver al inicio</Link>
            </Button>
        </div>
    )
}
