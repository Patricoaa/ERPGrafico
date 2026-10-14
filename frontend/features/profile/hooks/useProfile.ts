'use client'

import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '../api/profileApi'
import { PROFILE_KEYS } from './queryKeys'
import type { MyProfile } from "@/types/profile"
import { staleTime } from '@/lib/query-config'

export function useProfile() {
    return useQuery<MyProfile>({
        queryKey: PROFILE_KEYS.me(),
        queryFn: getMyProfile,
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })
}
