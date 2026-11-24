import { redirect } from "next/navigation"

/** `/hr/advances` pasó a `/hr/movements` (ADR-0156): anticipos, préstamos y pagos comparten un mismo documento. */
export default function AdvancesRedirect() {
  redirect("/hr/movements")
}
