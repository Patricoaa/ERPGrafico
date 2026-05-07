import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface PageContainerProps {
  children: ReactNode
  className?: string
  /**
   * Whether to apply the standard enter animation.
   * @default true
   */
  animate?: boolean
}

/**
 * Technical Contract: Contenedor estándar para páginas de módulo.
 * Encapsula el padding, espaciado y animaciones de entrada definidas en los contratos de la Capa 20.
 * Reemplaza el uso de LAYOUT_TOKENS.view.
 */
export function PageContainer({
  children,
  className,
  animate = true
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "flex-1 space-y-6 p-8 pt-6",
        animate && "animate-in fade-in duration-500",
        className
      )}
    >
      {children}
    </div>
  )
}
