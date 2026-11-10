"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
    setPosOperatorChallengeHandler,
    type OperatorPurpose,
    type PosOperatorChallengeRequest,
} from "@/lib/pos-operator"
import { posApi } from "../api/posApi"
import { usePOS } from "../contexts/POSProvider"
import { getBrowserSessionKey } from "../hooks/useDraftSync"
import type { IdentifyOperatorPayload, PosOperator } from "../types"
import { OperatorGateContext, type OperatorGateContextValue } from "./operatorGateContext"
import { operatorStore, type OperatorTarget } from "./operatorStore"
import { OperatorPickerModal } from "./OperatorPickerModal"
import { useIdentifyOperator, useOperators } from "./useOperators"

const DRAFT_TYPE = "sales.draftcart"
const DRAFT_URL = /pos-drafts\/(\d+)/

interface PendingRequest {
    purpose: OperatorPurpose
    target?: OperatorTarget
    promise: Promise<boolean>
    resolve: (identified: boolean) => void
}

function targetFromChallenge(
    purpose: OperatorPurpose,
    request: PosOperatorChallengeRequest,
    currentDraftId: number | null,
): OperatorTarget | undefined {
    if (purpose === "DRAFT") {
        const match = request.url?.match(DRAFT_URL)
        if (match) return { type: DRAFT_TYPE, id: Number(match[1]) }
        // El cobro (`POST sales/orders/`) no lleva el borrador en la url: es el que está en curso.
        if (currentDraftId !== null) return { type: DRAFT_TYPE, id: currentDraftId }
    }
    return operatorStore.getState().challengeTargets[purpose]
}

/**
 * Monta el selector de operador y responde al desafío del backend (403 `pos_operator_required`).
 * Va dentro de `POSProvider`. En sesiones de un solo usuario no hace nada visible.
 */
export function OperatorGateProvider({ children }: { children: ReactNode }) {
    const { currentSession, currentDraftId } = usePOS()
    const currentDraftIdRef = useRef(currentDraftId)
    useEffect(() => { currentDraftIdRef.current = currentDraftId }, [currentDraftId])
    const sessionId = currentSession?.id ?? null
    const isMultiUser = currentSession?.mode === "MULTI"

    const [pending, setPending] = useState<PendingRequest | null>(null)
    const pendingRef = useRef<PendingRequest | null>(null)
    const operators = useOperators(sessionId, pending !== null)
    const identify = useIdentifyOperator()

    // El pase pertenece a una sesión MULTI: al cambiar o cerrarse, se descarta.
    useEffect(() => {
        if (!isMultiUser) operatorStore.reset()
        return () => operatorStore.reset()
    }, [sessionId, isMultiUser])

    const settle = useCallback((identified: boolean) => {
        pendingRef.current?.resolve(identified)
        pendingRef.current = null
        setPending(null)
    }, [])

    const ensureOperator = useCallback(
        (purpose: OperatorPurpose, target?: OperatorTarget): Promise<boolean> => {
            if (!isMultiUser || sessionId === null) return Promise.resolve(true)
            const current = operatorStore.getState().pass
            if (current && current.purpose === purpose && current.targetId === (target?.id ?? null)) {
                return Promise.resolve(true)
            }
            if (pendingRef.current) return pendingRef.current.promise // ya hay un selector abierto
            let resolve!: (identified: boolean) => void
            const promise = new Promise<boolean>((r) => { resolve = r })
            const request: PendingRequest = { purpose, target, promise, resolve }
            pendingRef.current = request
            setPending(request)
            return promise
        },
        [isMultiUser, sessionId],
    )

    const handleSelect = useCallback(
        async (operator: PosOperator) => {
            const request = pendingRef.current
            if (!request || sessionId === null) return
            const payload: IdentifyOperatorPayload = {
                operator_id: operator.id,
                tab_key: getBrowserSessionKey(),
                purpose: request.purpose,
                ...(request.target ? { target_type: request.target.type, target_id: request.target.id } : {}),
            }
            try {
                const pass = await identify.mutateAsync({ sessionId, payload })
                operatorStore.setPass({
                    token: pass.token,
                    operator: pass.operator,
                    purpose: pass.purpose,
                    targetId: request.target?.id ?? null,
                })
                settle(true)
            } catch {
                // El error ya lo informa la capa de API; el selector sigue abierto para reintentar.
            }
        },
        [identify, sessionId, settle],
    )

    const release = useCallback(async (purpose?: OperatorPurpose) => {
        const live = operatorStore.getState().pass
        if (!live || sessionId === null) return
        if (purpose && live.purpose !== purpose) return // otro pase en curso: no se toca
        try {
            await posApi.releaseOperator(sessionId)
        } catch {
            // Si no se pudo avisar, el pase igual vence solo; el estado local se limpia de todos modos.
        } finally {
            operatorStore.setPass(null)
        }
    }, [sessionId])

    // Responde al 403 pos_operator_required del interceptor: el pase rechazado ya no sirve.
    useEffect(() => {
        if (!isMultiUser) return
        setPosOperatorChallengeHandler((purpose, request) => {
            operatorStore.setPass(null)
            return ensureOperator(purpose, targetFromChallenge(purpose, request, currentDraftIdRef.current))
        })
        return () => setPosOperatorChallengeHandler(null)
    }, [isMultiUser, ensureOperator])

    const value = useMemo<OperatorGateContextValue>(
        () => ({
            isMultiUser,
            ensureOperator,
            release,
            forget: () => operatorStore.setPass(null),
            bindTarget: operatorStore.bindTarget,
            setChallengeTarget: operatorStore.setChallengeTarget,
        }),
        [isMultiUser, ensureOperator, release],
    )

    return (
        <OperatorGateContext.Provider value={value}>
            {children}
            <OperatorPickerModal
                open={pending !== null}
                operators={operators.data ?? []}
                isLoading={operators.isLoading}
                isError={operators.isError}
                onRetry={() => void operators.refetch()}
                onSelect={(operator) => void handleSelect(operator)}
                onCancel={() => settle(false)}
                isSubmitting={identify.isPending}
            />
        </OperatorGateContext.Provider>
    )
}
