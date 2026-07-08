"use client"

import type { Absence } from "@/types/hr"
import { AbsenceClientView } from "@/features/hr"

interface AbsencesPageClientProps {
    initialAbsences?: Absence[]
}

export default function AbsencesPageClient({ initialAbsences }: AbsencesPageClientProps) {
    return <AbsenceClientView initialAbsences={initialAbsences} />
}
