'use client'

import { useQuery } from '@tanstack/react-query'
import { getMyProfile } from '../api/profileApi'
import { PROFILE_KEYS } from './queryKeys'
import type { MyProfile } from "@/types/profile"

export function useProfile() {
    return useQuery<MyProfile>({
        queryKey: PROFILE_KEYS.me(),
        queryFn: getMyProfile,
        staleTime: 5 * 60 * 1000,
    })
}
