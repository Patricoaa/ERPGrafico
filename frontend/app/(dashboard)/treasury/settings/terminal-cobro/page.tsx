import { redirect } from "next/navigation"

export default function TreasurySettingsTerminalCobroPage() {
    redirect("/treasury/operaciones/movements?modal=settings&tab=terminal-cobro")
}
