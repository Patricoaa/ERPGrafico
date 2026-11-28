import { redirect } from "next/navigation"

export default function TreasurySettingsPage() {
    redirect("/treasury/operaciones/movements?modal=settings&tab=terminal-cobro")
}
