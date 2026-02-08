"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TerminalManagement } from "@/components/treasury/TerminalManagement"
import { Banknote, List } from "lucide-react"
import POSSessionsPage from "../sessions/page"

export default function TerminalsPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Terminales y Sesiones</h2>
                    <p className="text-muted-foreground">Administración de puntos de venta y control de turnos.</p>
                </div>
            </div>

            <Tabs defaultValue="terminals" className="space-y-4">
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-w-2xl grid-cols-2 bg-muted/50 rounded-full h-12 p-1 border">
                        <TabsTrigger value="terminals" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <Banknote className="h-4 w-4" />
                            <span className="max-sm:hidden">Terminales POS</span>
                        </TabsTrigger>
                        <TabsTrigger value="sessions" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                            <List className="h-4 w-4" />
                            <span className="max-sm:hidden">Historial de Sesiones</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="terminals">
                    <TerminalManagement />
                </TabsContent>

                <TabsContent value="sessions">
                    <POSSessionsPage />
                </TabsContent>
            </Tabs>
        </div>
    )
}
