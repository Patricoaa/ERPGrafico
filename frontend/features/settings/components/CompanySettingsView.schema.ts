import * as z from "zod"

export const companySchema = z.object({
    name: z.string().optional().or(z.literal("")),
    trade_name: z.string().default(""),
    tax_id: z.string().optional().or(z.literal("")),
    address: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().email("Email inválido").or(z.literal("")).default(""),
    website: z.string().url("URL inválida").or(z.literal("")).default(""),
    logo_url: z.string().default(""),
    logo: z.string().nullable().default(null),
    primary_color: z.string().default("#0f172a"),
    secondary_color: z.string().default("#3b82f6"),
    business_activity: z.string().default(""),
    contact: z.number().nullable().default(null),
}).refine(data => {
    // If no contact is linked, name and tax_id MUST be present
    if (!data.contact) {
        return !!data.name && !!data.tax_id && data.name.length > 0 && data.tax_id.length > 0;
    }
    return true;
}, {
    message: "La razón social y el RUT son obligatorios si no hay contacto vinculado",
    path: ["name"]
});

export type CompanyFormValues = z.infer<typeof companySchema>
