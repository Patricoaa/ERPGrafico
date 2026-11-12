/**
 * Petición de acción sobre un socio. Una sola unión tipada reemplaza a los flags
 * `isXOpen` por modal: cualquier superficie (lista, ficha) pide una acción con
 * `run(request)` y `PartnerActionModal` monta la superficie que corresponde.
 */
export type PartnerActionRequest =
    | { type: "add-partner"; contactId?: number }
    | { type: "subscription"; partnerId?: number; amount?: string }
    | { type: "transfer" }
    | { type: "contribution"; partnerId?: number; amount?: string }
    | { type: "withdrawal"; partnerId?: number }
    | { type: "dividend"; partnerId?: number }
    | { type: "mobilize"; partnerId?: number }
    | { type: "demote"; partnerId: number }

export type PartnerActionRunner = (request: PartnerActionRequest) => void
