import { redirect } from "next/navigation"

export default async function AnalysisPage() {
    redirect("/finances/analysis/ratios")
}
