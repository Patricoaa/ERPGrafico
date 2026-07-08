export const PROFILE_KEYS = {
    all: ['profile'] as const,
    me: () => [...PROFILE_KEYS.all, 'me'] as const,
    preferences: () => [...PROFILE_KEYS.all, 'preferences'] as const,
    partnerStatement: (contactId: number) => [...PROFILE_KEYS.all, 'partnerStatement', contactId] as const,
}
