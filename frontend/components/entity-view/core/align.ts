import type { Align } from "./value-kinds"

/** Text alignment for table cells and headers. */
export const ALIGN_TEXT: Record<Align, string> = { start: "text-left", center: "text-center", end: "text-right" }

/** Flex + text alignment for cell content (DataCell centers by default, so kinds override it). */
export const ALIGN_FLEX: Record<Align, string> = {
    start: "justify-start text-left",
    center: "justify-center text-center",
    end: "justify-end text-right",
}
