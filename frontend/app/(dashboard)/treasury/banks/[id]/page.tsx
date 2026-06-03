"use client"

import { useParams } from "next/navigation"
import { BankCenterView } from "@/features/treasury/components/BankCenterView"

export default function BankCenterPage() {
    const params = useParams()
    const bankId = Number(params.id)

    if (!bankId) return null

    return <BankCenterView bankId={bankId} />
}
