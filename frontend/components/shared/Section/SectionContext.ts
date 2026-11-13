import { createContext, useContext } from "react"

/** Id del título de la sección actual: lo publica `Section` y lo consume `Section.Header` (aria-labelledby). */
export const SectionTitleIdContext = createContext<string | undefined>(undefined)

export const useSectionTitleId = () => useContext(SectionTitleIdContext)
