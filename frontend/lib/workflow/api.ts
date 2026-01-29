import api from "@/lib/api"

export interface Task {
    id: number
    title: string
    description: string
    task_type: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    assigned_to: number | null
    assigned_to_data?: any
    created_by: number | null
    created_by_data?: any
    created_at: string
    due_date?: string
    object_id?: number
    completed_by?: number | null
    completed_by_data?: any
    completed_at?: string
    data?: any
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
    assigned_user_data?: any
}

// Tasks
export const getTasks = async (params: any = {}) => {
    const response = await api.get('/workflow/tasks/', { params })
    return response.data
}

export const completeTask = async (id: number) => {
    const response = await api.post(`/workflow/tasks/${id}/complete/`)
    return response.data
}

// Notifications
export const getNotifications = async () => {
    const response = await api.get('/workflow/notifications/')
    return response.data
}

export const getUnreadNotificationCount = async () => {
    const response = await api.get('/workflow/notifications/unread_count/')
    return response.data.count
}

export const markNotificationRead = async (id: number) => {
    const response = await api.post(`/workflow/notifications/${id}/mark_read/`)
    return response.data
}

export const markAllNotificationsRead = async () => {
    const response = await api.post(`/workflow/notifications/mark_all_read/`)
    return response.data
}

// Rules (Admin)
export const getAssignmentRules = async () => {
    const response = await api.get('/workflow/assignment-rules/')
    return response.data
}

export const updateAssignmentRule = async (id: number, data: any) => {
    const response = await api.patch(`/workflow/assignment-rules/${id}/`, data)
    return response.data
}

export const createAssignmentRule = async (data: any) => {
    const response = await api.post(`/workflow/assignment-rules/`, data)
    return response.data
}
