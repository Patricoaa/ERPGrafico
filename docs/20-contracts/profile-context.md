---
layer: 20-contracts
doc: profile-context
status: active
owner: frontend-team
last_review: 2026-06-19
stability: contract-changes-require-ADR
---

# Profile Context (`ProfileProvider` + `useMyProfile`)

Provides the authenticated user's profile to the component tree under `/profile/*`.

---

## `ProfileProvider`

Wraps the profile layout and makes `MyProfile` data available to all sub-routes without re-fetching.

### Props

| prop | type | required | description |
|------|------|----------|-------------|
| `profile` | `MyProfile` | yes | The full profile object fetched by `ProfileLayoutClient` |
| `children` | `ReactNode` | yes | Component tree |

### Usage

```tsx
<ProfileProvider profile={profile}>
    {children}
</ProfileProvider>
```

Only rendered by `ProfileLayoutClient` after a successful `useProfile()` query.

---

## `useMyProfile`

Hook that consumes `ProfileContext`. Used by sub-pages and `ProfileNavigation` to read profile data.

### Returns

| property | type | description |
|----------|------|-------------|
| `profile` | `MyProfile` | Full profile object (user, employee, payrolls, etc.) |
| `isPartner` | `boolean` | Derived from `contact_detail.is_partner` |
| `contactDetail` | `ContactMini \| null \| undefined` | Primary contact info |

### Usage

```tsx
const { profile, isPartner } = useMyProfile()
```

### Throws

If called outside of `ProfileProvider`, throws `"useMyProfile must be used within ProfileProvider"`.

---

## Data flow

```
ProfileLayoutClient (useProfile → useQuery)
  └── ProfileProvider (context)
        ├── ProfileNavigation (tabs, header)
        ├── ProfileSidePanel (avatar, role, contact)
        └── sub-pages (useMyProfile → profile → ProfileView)
```

- `ProfileLayoutClient` fetches profile once via `useProfile()`.
- On success, renders `ProfileProvider` with the profile data.
- All sub-pages consume the profile via `useMyProfile()` and pass it as `initialProfile` to `ProfileView`.
- `loading.tsx` at route level shows `PageLayoutSkeleton` during initial fetch.

---

## Query keys

Managed in `features/profile/hooks/queryKeys.ts`:

```ts
export const PROFILE_KEYS = {
    all: ['profile'] as const,
    me: () => [...PROFILE_KEYS.all, 'me'] as const,
    preferences: () => [...PROFILE_KEYS.all, 'preferences'] as const,
    partnerStatement: (contactId: number) => [...PROFILE_KEYS.all, 'partnerStatement', contactId] as const,
}
```
