"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"
import { Drawer } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDocumentRelations } from "../hooks/useDocumentRelations"
import { DocumentRelationsTab } from "./DocumentRelationsTab"

/**
 * Acceso a las relaciones de un documento cuya ficha es un flujo propio (OT, liquidación de
 * sueldo — ADR-0083 U5): botón de cabecera que abre el tab Relaciones reutilizable en un panel
 * lateral. Los documentos relacionados se abren apilados con "volver".
 */
export function DocumentRelationsButton({ label, id }: { label: string; id: number | null | undefined }) {
    const [open, setOpen] = useState(false)
    const { data } = useDocumentRelations(label, id ?? null)
    if (!id) return null
    const count = data?.relations.length

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="active:scale-[0.98]">
                <Link2 />
                Relaciones{count ? ` (${count})` : ""}
            </Button>
            <Drawer
                open={open}
                onOpenChange={setOpen}
                side="right"
                defaultSize={formDrawerWidth("medium", false)}
                title="Documentos relacionados"
                icon={Link2}
                mode="view"
            >
                <div className="p-6">
                    <DocumentRelationsTab label={label} id={id} />
                </div>
            </Drawer>
        </>
    )
}
