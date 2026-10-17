import { FLEX_ALIGN_CLASS } from "@/lib/utils"
import type { Align } from "./value-kinds"

/** Text alignment for table cells and headers. */
export const ALIGN_TEXT: Record<Align, string> = { start: "text-left", center: "text-center", end: "text-right" }

/** Flex + text alignment for the kinds' own wrappers: the same classes DataCell uses for `align`. */
export const ALIGN_FLEX: Record<Align, string> = FLEX_ALIGN_CLASS
