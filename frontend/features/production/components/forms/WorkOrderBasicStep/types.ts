import type { WorkOrderInitialData } from '@/types/forms'

export interface WorkOrderBasicStepProps {
    mode: 'create' | 'edit' | 'view'
    initialData?: WorkOrderInitialData
    defaultOtType?: 'LINKED' | 'NONE'
    defaultProductId?: string
    chosenOtType?: 'LINKED' | 'NONE' | null
    onTypeChange?: (type: 'LINKED' | 'NONE' | null) => void
    onSuccess?: (workOrderId: number) => void
    formId?: string
    onLoadingChange?: (loading: boolean) => void
}
