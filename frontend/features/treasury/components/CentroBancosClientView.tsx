"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { BankCenterView, BankManagement } from "@/features/treasury"
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
            return (
                <div className="flex-1 min-h-0 flex flex-col">
                    <BankCenterView bankId={bankId} />
                </div>
            )
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
                        href="/treasury/centro-bancos?modal=new"
                    />
                }
            />
        </div>
    )
}
