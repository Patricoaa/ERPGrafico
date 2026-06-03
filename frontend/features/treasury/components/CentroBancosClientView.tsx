"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { BankCenterAllView, BankCenterView, BankManagement } from "@/features/treasury"
import { ToolbarCreateButton } from "@/components/shared"

export function CentroBancosClientView() {
    const searchParams = useSearchParams()
    const bank = searchParams.get("bank")
    const modal = searchParams.get("modal")
    const [modalOpen, setModalOpen] = useState(false)

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

    if (bank) {
        const bankId = Number(bank)
        if (bankId) {
            return <BankCenterView bankId={bankId} />
        }
    }

    return (
        <div className="space-y-6">
            <BankCenterAllView />
            <BankManagement
                externalOpen={modalOpen}
                onOpenChange={handleModalChange}
                createAction={
                    <ToolbarCreateButton
                        label="Nuevo Banco"
                        href="/treasury/centro-bancos?modal=new"
                    />
                }
            />
        </div>
    )
}
