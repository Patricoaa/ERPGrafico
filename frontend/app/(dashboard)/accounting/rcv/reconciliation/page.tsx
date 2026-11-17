import { redirect } from "next/navigation"

/** Ruta anterior del cuadre: los enlaces guardados siguen funcionando. */
export default function AccountingRcvReconciliationPage() {
  redirect("/accounting/rcv/cuadre")
}
