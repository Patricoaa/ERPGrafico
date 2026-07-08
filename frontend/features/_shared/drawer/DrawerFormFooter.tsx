import type { ReactNode } from "react"
import { FormFooter } from "@/components/shared"

/**
 * Helper que retorna undefined (no renderiza footer) cuando isView es true.
 * Uso: `footer={drawerFooter(isView, <>...</>)}`
 *
 * Es función, no componente, para que `undefined` se propague correctamente
 * al guard `{footer && (...)}` de `<Drawer>`.
 */
export function drawerFooter(isView: boolean, children: ReactNode) {
  return isView ? undefined : <FormFooter actions={children} />
}
