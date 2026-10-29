import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../api/settingsApi'
import type { CompanyBranding } from '../types'
import { staleTime } from '@/lib/query-config'

export const COMPANY_BRANDING_QUERY_KEY = ['company-branding']

interface UseCompanyBrandingReturn {
    branding: CompanyBranding | undefined
    isLoading: boolean
}

/**
 * Public branding hook — does not require authentication.
 * Used by BrandingProvider for login, 404, sidebar, etc.
 */
export function useCompanyBranding(): UseCompanyBrandingReturn {
    const { data: branding, isLoading } = useQuery({
        queryKey: COMPANY_BRANDING_QUERY_KEY,
        queryFn: settingsApi.getCompanyBranding,
        staleTime: staleTime.slow, // 10 min — branding rarely changes
    })

    return { branding, isLoading }
}
