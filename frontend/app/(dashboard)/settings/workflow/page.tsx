import { redirect } from "next/navigation"

export default async function WorkflowSettingsPage() {
    redirect("/settings/workflow/approvals")
}
