"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileQuestion } from "lucide-react"
import { EmptyState, SkeletonShell, StatusBadge } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { hasEntityDrawer } from "@/lib/entity-drawers"
import { getErrorMessage } from "@/lib/errors"
import { useDocumentRef } from "../hooks/useDocumentRef"

const RESOLVER_PREFIX = "/d/"

interface DocumentResolverViewProps {
    label: string
    id: number
}

/**
 * Resolvedor `/d/{label}/{id}` (ADR-0080): abre cualquier documento por tipo + id.
 * - Si el tipo tiene una URL canónica propia (lista con `?selected`), redirige allí.
 * - Si no, abre su drawer registrado en ENTITY_DRAWERS con `openEntity`.
 */
export function DocumentResolverView({ label, id }: DocumentResolverViewProps) {
    const router = useRouter()
    const { openEntity } = useGlobalModals()
    const { data: ref, isLoading, error } = useDocumentRef(label, id)
    const openedRef = useRef(false)

    const redirectUrl = ref?.url && !ref.url.startsWith(RESOLVER_PREFIX) ? ref.url : null
    const canOpen = hasEntityDrawer(label)

    useEffect(() => {
        if (redirectUrl) {
            router.replace(redirectUrl)
        } else if (ref?.exists && canOpen && !openedRef.current) {
            openedRef.current = true
            openEntity(label, id)
        }
    }, [redirectUrl, ref?.exists, canOpen, label, id, openEntity, router])

    if (isLoading || redirectUrl) {
        return <SkeletonShell isLoading ariaLabel="Abriendo documento" />
    }

    if (error || !ref) {
        return (
            <EmptyState
                icon={FileQuestion}
                title="No se pudo abrir el documento"
                description={error ? getErrorMessage(error) : undefined}
            />
        )
    }

    return (
        <div className="p-6">
            <div className="flex flex-col gap-3 rounded-md border p-4 max-w-xl">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{ref.title}</span>
                    <span className="font-medium">{ref.display_id}</span>
                    {ref.status && <StatusBadge status={ref.status} variant="badge" />}
                </div>
                {ref.partner_name && <p className="text-sm text-muted-foreground">{ref.partner_name}</p>}
                {canOpen ? (
                    <Button variant="outline" className="self-start" onClick={() => openEntity(label, id)}>
                        Abrir documento
                    </Button>
                ) : (
                    <p className="text-sm text-muted-foreground">Este tipo de documento aún no tiene ficha.</p>
                )}
            </div>
        </div>
    )
}
