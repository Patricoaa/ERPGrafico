"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BankManagement } from "@/features/treasury"
import { ToolbarCreateButton } from "@/components/shared"

export function BankCenterPageClientView() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const bank = searchParams.get("bank")
    const modal = searchParams.get("modal")
    const [modalOpen, setModalOpen] = useState(false)

    // Redirect legacy ?bank=X query param to new URL segment
    useEffect(() => {
        const bankId = Number(bank)
        if (bankId) {
            router.replace(`/treasury/bank-center/${bankId}`)
        }
    }, [bank, router])

    useEffect(() => {
        if (modal === "new") {
            const handle = requestAnimationFrame(() => setModalOpen(true))
            return () => cancelAnimationFrame(handle)
        }
    }, [modal])

    const handleModalChange = (open: boolean) => {
        setModalOpen(open)
        if (!open) {
            const url = new URL(window.location.href)
            url.searchParams.delete("modal")
            window.history.replaceState({}, "", url.toString())
        }
    }

    return (
        <div className="h-full flex flex-col">
            <BankManagement
                externalOpen={modalOpen}
                onOpenChange={handleModalChange}
                createAction={
                    <ToolbarCreateButton
                        label="Nuevo Banco"
                        href="/treasury/bank-center?modal=new"
                    />
                }
            />
        </div>
    )
}
