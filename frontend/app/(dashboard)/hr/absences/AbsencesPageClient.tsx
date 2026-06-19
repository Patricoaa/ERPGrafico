"use client"

import type { Absence } from "@/types/hr"
import { AbsenceManagementView } from "@/features/hr"

interface AbsencesPageClientProps {
    initialAbsences?: Absence[]
}

export default function AbsencesPageClient({ initialAbsences }: AbsencesPageClientProps) {
    return <AbsenceManagementView initialAbsences={initialAbsences} />
}
