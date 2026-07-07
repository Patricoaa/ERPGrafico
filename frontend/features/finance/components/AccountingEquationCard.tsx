"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared"
import { CheckCircle2, AlertTriangle } from "lucide-react"

interface AccountingEquationProps {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    check: number
    className?: string
}

export function AccountingEquation({ totalAssets, totalLiabilities, totalEquity, check, className }: AccountingEquationProps) {
    const isBalanced = Math.abs(check) < 0.01
    const totalLiabEq = totalLiabilities + totalEquity

    return (
        <div className={cn(
            "rounded-md border shadow-card overflow-hidden transition-all duration-500",
            isBalanced ? "border-success/20" : "border-destructive/30",
            className
        )}>
            <div className={cn(
                "px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors",
                isBalanced ? "bg-success/5" : "bg-destructive/5"
            )}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        isBalanced ? "bg-success/15" : "bg-destructive/15"
                    )}>
                        {isBalanced ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className={cn(
                            "text-xs font-black uppercase tracking-widest",
                            isBalanced ? "text-success" : "text-destructive"
                        )}>
                            {isBalanced ? "Ecuación Contable Verificada" : "Diferencia Contable Detectada"}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                            Activos = Pasivos + Patrimonio
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Activos</span>
                        <MoneyDisplay amount={totalAssets} showColor={false} className="font-black font-mono tabular-nums" />
                    </div>
                    <span className="text-muted-foreground/40 font-black text-lg hidden sm:inline">=</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Pasivos</span>
                        <MoneyDisplay amount={totalLiabilities} showColor={false} className="font-black font-mono tabular-nums" />
                    </div>
                    <span className="text-muted-foreground/30 hidden sm:inline">+</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Patrimonio</span>
                        <MoneyDisplay amount={totalEquity} showColor={false} className="font-black font-mono tabular-nums" />
                    </div>
                    <span className="text-muted-foreground/30 hidden sm:inline">=</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Total P + P</span>
                        <MoneyDisplay amount={totalLiabEq} showColor={false} className="font-black font-mono tabular-nums" />
                    </div>
                </div>
            </div>

            {!isBalanced && (
                <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-destructive tracking-wider">Diferencia:</span>
                    <MoneyDisplay amount={check} className="font-black font-mono tabular-nums" />
                </div>
            )}
        </div>
    )
}
