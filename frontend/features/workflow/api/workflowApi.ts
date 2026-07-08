import api from "@/lib/api"

/**
 * Resolves a media URL from the backend.
 * If the path is relative (starts with /media/), it prepends the backend host.
 * If the path is already absolute, it returns it as-is.
 */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }

  // Derive backend host from baseURL (stripping /api/ if present)
  const rawBaseURL = process.env.NEXT_PUBLIC_API_URL || ''
  const backendHost = rawBaseURL.replace(/\/api\/?$/, '')

  // Ensure the path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${backendHost}${normalizedPath}`
}

// ─── Sub-types ────────────────────────────────────────────

/** Minimal user data embedded in task responses */
export interface TaskUserData {
    id: number
    username: string
    first_name?: string
    last_name?: string
}

/** File attachment returned by the API */
export interface TaskAttachment {
    id: number
    file: string
    original_filename: string
}

/**
 * Freeform context payload that varies per task type.
 * Typed with known keys; unlisted keys use `unknown` via index signature.
 */
export interface TaskContextData {
    // Common
    stage?: string
    order_type?: 'sale' | 'purchase' | string
    order_number?: string | number
    order_total?: number | string
    contact_name?: string
    delivery_date?: string
    is_invoice?: boolean
    prefix?: string
    action_name?: string
    candidate_group?: string
    // Tax tasks
    year?: string | number
    month?: string | number
    // Credit POS
    customer_id?: number
    customer_name?: string
    customer_debt?: number | string
    explicit_credit?: number | string
    credit_available?: number | string
    pos_credit?: number | string
    required_credit?: number | string
    is_default_customer?: boolean
    // Hub / sales
    sale_order_id?: number
    [key: string]: unknown
}

// ─── Core Interfaces ──────────────────────────────────────

export interface Task {
    id: number
    title: string
    description: string
    task_type: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    assigned_to: number | null
    assigned_to_data?: TaskUserData
    assigned_group?: number | null
    assigned_group_name?: string
    created_by: number | null
    created_by_data?: TaskUserData
    created_at: string
    due_date?: string
    object_id?: number
    completed_by?: number | null
    completed_by_data?: TaskUserData
    completed_at?: string
    notes?: string
    attachments_data?: TaskAttachment[]
    data?: TaskContextData
}

export interface Notification {
    id: number
    title: string
    message: string
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
    read: boolean
    link?: string
    created_at: string
}

export interface TaskAssignmentRule {
    id: number
    task_type: string
    description: string
    assigned_user: number | null
    assigned_user_data?: TaskUserData
}

// ─── API Param & Payload types ────────────────────────────

export interface TaskQueryParams {
    category?: 'APPROVAL' | 'TASK' | string
    status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
    task_type?: string
    assigned_to?: number
    limit?: number
    offset?: number
}

export interface AssignmentRulePayload {
    task_type: string
    assigned_user: number | null
    assigned_group: string | null
}

export interface NotificationRulePayload {
    notification_type: string
    assigned_user?: number | null
    assigned_group?: string | null
    notify_creator?: boolean
    [key: string]: unknown
}

// ─── API Functions ────────────────────────────────────────

// Tasks
export const getTasks = async (params: TaskQueryParams = {}) => {
    const response = await api.get('workflow/tasks/', { params })
    return response.data.results
}

/**
 * Fetch del detalle de una task. Imperativo, usado en polls de estado
 * (p.ej. wizard de venta esperando aprobación de crédito).
 */
export const getTask = async <T = Task>(taskId: number | string): Promise<T> => {
    const response = await api.get<T>(`workflow/tasks/${taskId}/`)
    return response.data
}

export const completeTask = async (id: number, notes?: string, attachments?: File[]) => {
    const formData = new FormData()
    if (notes) formData.append('notes', notes)
    if (attachments) {
        attachments.forEach(file => formData.append('attachments', file))
    }
    const response = await api.post(`workflow/tasks/${id}/complete/`, formData)
    return response.data
}

export const updateTask = async (id: number, payload: Record<string, unknown>) => {
    const response = await api.patch(`/workflow/tasks/${id}/`, payload)
    return response.data
}

// Notifications
export const getNotifications = async () => {
    const response = await api.get('workflow/notifications/')
    return response.data.results
}

export const getUnreadNotificationCount = async () => {
    const response = await api.get('workflow/notifications/unread_count/')
    return response.data.count
}

export const markNotificationRead = async (id: number) => {
    const response = await api.post(`workflow/notifications/${id}/mark_read/`)
    return response.data
}

export const markAllNotificationsRead = async () => {
    const response = await api.post(`workflow/notifications/mark_all_read/`)
    return response.data
}

// Notification Rules
export const getNotificationRules = async () => {
    const response = await api.get('workflow/notification-rules/')
    // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
    return response.data
}

export const updateNotificationRule = async (id: number, data: NotificationRulePayload) => {
    const response = await api.patch(`workflow/notification-rules/${id}/`, data)
    return response.data
}

export const createNotificationRule = async (data: NotificationRulePayload) => {
    const response = await api.post(`workflow/notification-rules/`, data)
    return response.data
}

// Rules (Admin)
export const getAssignmentRules = async () => {
    const response = await api.get('workflow/assignment-rules/')
    // eslint-disable-next-line pagination/no-raw-response-data -- master data, no pagination
    return response.data
}

export const updateAssignmentRule = async (id: number, data: AssignmentRulePayload) => {
    const response = await api.patch(`workflow/assignment-rules/${id}/`, data)
    return response.data
}

export const createAssignmentRule = async (data: AssignmentRulePayload) => {
    const response = await api.post(`workflow/assignment-rules/`, data)
    return response.data
}

// Workflow Settings
export const updateWorkflowSettings = async (data: Record<string, unknown>) => {
    const response = await api.patch("/workflow/settings/current/", data)
    return response.data
}
