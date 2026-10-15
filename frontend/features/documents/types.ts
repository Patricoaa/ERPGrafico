import * as z from "zod"

/** Área operativa (ADR-0083): agrupa los relacionados en el orden del ciclo. */
export const DOCUMENT_DOMAINS = [
    "origin", "billing", "production", "logistics", "treasury", "accounting", "other",
] as const
export const documentDomainSchema = z.enum(DOCUMENT_DOMAINS)
export type DocumentDomain = z.infer<typeof documentDomainSchema>

/** DocumentRef — contrato document-relations.md (ADR-0080). */
export const documentRefSchema = z.object({
    label: z.string(),
    id: z.number(),
    display_id: z.string(),
    title: z.string(),
    icon: z.string().nullable(),
    domain: documentDomainSchema.catch("other"),
    status: z.string().nullable(),
    status_display: z.string().nullable(),
    date: z.string().nullable(),
    partner_name: z.string().nullable(),
    url: z.string().nullable(),
    accessible: z.boolean(),
    exists: z.boolean(),
})
export type DocumentRef = z.infer<typeof documentRefSchema>

export const documentSemanticSchema = z.enum([
    "derivation", "fulfillment", "settlement", "posting", "correction", "reference", "association",
])
export type DocumentSemantic = z.infer<typeof documentSemanticSchema>

export const documentLinkSchema = z.object({
    semantic: documentSemanticSchema,
    direction: z.enum(["outgoing", "incoming"]),
    role: z.string(),
    target: documentRefSchema,
    amount: z.union([z.string(), z.number()]).nullable(),
    quantity: z.union([z.string(), z.number()]).nullable(),
    is_dependency: z.boolean(),
})
export type DocumentLink = z.infer<typeof documentLinkSchema>

export const documentRelationsSchema = z.object({
    document: documentRefSchema,
    relations: z.array(documentLinkSchema),
    unresolved: z.array(z.object({
        label: z.string(),
        id: z.union([z.string(), z.number()]),
        role: z.string(),
        reason: z.string(),
    })),
})
export type DocumentRelations = z.infer<typeof documentRelationsSchema>

export interface DocumentRelationsFilters {
    semantic?: DocumentSemantic
    direction?: "outgoing" | "incoming"
}
