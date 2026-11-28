import { redirect } from "next/navigation"

export default function SalesSettingsConfigPosPage() {
    redirect("/sales/docs?modal=settings&tab=config_pos")
}
