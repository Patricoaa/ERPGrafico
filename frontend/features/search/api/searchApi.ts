import api from '@/lib/api'

export interface SearchResult {
    label: string
    title: string
    title_plural: string
    icon: string
    id: number
    display: string
    subtitle?: string
    extra_info?: string
    list_url: string
    detail_url: string
}

export interface SearchResponse {
    results: SearchResult[]
}

export const searchApi = {
    search: async (q: string, limit = 20): Promise<SearchResult[]> => {
        const { data } = await api.get<SearchResponse>('/core/search/', {
            params: { q, limit },
        })
        return data.results
    },
}
