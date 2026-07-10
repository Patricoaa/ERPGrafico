"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BankCenterClientView } from "@/features/treasury"
import { ToolbarCreateButton } from "@/components/shared"

export default function BankCenterPageClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const bank = searchParams.get("bank")
    const modal = searchParams.get("modal")
    const [modalOpen, setModalOpen] = useState(false)

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
        <div className="flex-1 min-h-0 flex flex-col">
            <BankCenterClientView
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
