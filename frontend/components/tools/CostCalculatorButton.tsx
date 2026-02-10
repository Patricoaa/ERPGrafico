"use client"

import { useState } from "react"
import { Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CostCalculatorModal } from "./CostCalculatorModal"

export function CostCalculatorButton() {
    const [open, setOpen] = useState(false)

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    size="lg"
                    onClick={() => setOpen(true)}
                    className="shadow-lg hover:shadow-xl transition-shadow"
                >
                    <Calculator className="h-5 w-5 mr-2" />
                    Calcular Costos
                </Button>
            </div>
            <CostCalculatorModal open={open} onOpenChange={setOpen} />
        </>
    )
}
