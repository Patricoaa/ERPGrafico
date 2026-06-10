"use client"

import React from "react"
import { useSearchParams } from "next/navigation"
import { LoansView } from "./LoansView"

export function LoansClientView() {
    const searchParams = useSearchParams()
    const bank = searchParams.get("bank")

    return <LoansView bankId={bank ? Number(bank) : undefined} />
}
