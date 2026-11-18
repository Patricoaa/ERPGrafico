"use client"

import { useQuery } from "@tanstack/react-query"
import { fiscalMatchApi } from "../api/fiscalMatchApi"
import type { FiscalMatchSearchItem } from "../types/fiscalMatch"
import type { Page } from "@/lib/pagination"

export interface UseInvoiceFiscalMatchCandidatesParams {
    invoiceId?: number | null
    direction?: string
    siiCode?: number
    counterpartyRut?: string | null
    amount?: number | null
    q?: string
    ordering?: "score" | "recent"
    page?: number
    enabled?: boolean
}

export function useInvoiceFiscalMatchCandidates({
    invoiceId,
    direction,
    siiCode,
    counterpartyRut,
    amount,
    q = "",
    ordering = "score",
    page = 1,
    enabled = true,
}: UseInvoiceFiscalMatchCandidatesParams) {
    const isReady = !!(invoiceId || (direction && siiCode))

    return useQuery<Page<FiscalMatchSearchItem & { fiscal_match_id: number }>>({
        queryKey: [
            "tax",
            "fiscal-matches",
            "invoice-candidates",
            { invoiceId, direction, siiCode, counterpartyRut, amount, q, ordering, page },
        ],
        queryFn: ({ signal }) =>
            fiscalMatchApi.invoiceCandidates(
                {
                    invoice_id: invoiceId,
                    direction,
                    sii_code: siiCode,
                    counterparty_rut: counterpartyRut,
                    amount,
                    q,
                    ordering,
                    page,
                },
                signal
            ),
        enabled: enabled && isReady,
        staleTime: 30_000,
    })
}
