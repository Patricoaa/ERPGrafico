import { z } from 'zod'

// Comment posted inside an OT stage
const ProductionCommentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  user: z.string(),
  text: z.string(),
  timestamp: z.string(),
})

// Active process phases
const PhasesSchema = z.object({
  prepress: z.boolean().optional(),
  press: z.boolean().optional(),
  postpress: z.boolean().optional(),
})

// Data carried inside a single process phase (prepress / press / postpress)
// and also at the root of stage_data (flattened copy for legacy access)
export const WorkOrderPhaseDataSchema = z.object({
  internal_notes: z.string().optional(),
  product_description: z.string().optional(),
  contact_id: z.union([z.number(), z.string()]).nullable().optional(),
  contact_name: z.string().optional(),
  contact_tax_id: z.string().optional(),
  folio_enabled: z.boolean().optional(),
  folio_start: z.string().optional(),
  design_attachments: z.array(z.string()).optional(),
  design_approved: z.boolean().optional(),
  approval_attachment: z.string().nullable().optional(),
  prepress_specs: z.string().optional(),
  press_specs: z.string().optional(),
  postpress_specs: z.string().optional(),
  design_needed: z.boolean().optional(),
  print_type: z.string().nullable().optional(),
  comments: z.array(ProductionCommentSchema).optional(),
})

// Root stage_data object — extends phase data with OT-level fields
// and nested per-stage sub-objects written by transition_to()
export const WorkOrderStageDataSchema = WorkOrderPhaseDataSchema.extend({
  // OT-level (manual / delivery OTs)
  quantity: z.union([z.number(), z.string()]).optional(),
  uom_id: z.union([z.number(), z.string()]).optional(),
  uom_name: z.string().optional(),
  // Which process phases are active for this OT
  phases: PhasesSchema.optional(),
  // Per-stage sub-objects populated incrementally by transition_to()
  prepress: WorkOrderPhaseDataSchema.optional(),
  press: WorkOrderPhaseDataSchema.optional(),
  postpress: WorkOrderPhaseDataSchema.optional(),
})

export type WorkOrderPhaseData = z.infer<typeof WorkOrderPhaseDataSchema>
export type WorkOrderStageData = z.infer<typeof WorkOrderStageDataSchema>

/**
 * Parse and validate stage_data from the API.
 * Returns the validated object, or a safe empty default on failure.
 */
export function parseStageData(raw: unknown): WorkOrderStageData {
  const result = WorkOrderStageDataSchema.safeParse(raw ?? {})
  if (result.success) return result.data
  console.warn('[production] stage_data validation failed:', result.error.flatten())
  return {}
}

/**
 * Validate transition payload before sending to the API.
 * Returns the validated data or throws a ZodError with field-level messages.
 */
export function validateTransitionData(raw: unknown): WorkOrderPhaseData {
  return WorkOrderPhaseDataSchema.parse(raw)
}
