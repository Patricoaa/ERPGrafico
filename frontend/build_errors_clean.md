
> frontend@0.1.0 build
> next build

▲ Next.js 16.1.1 (Turbopack)
- Environments: .env.local
- Experiments (use with caution):
  · optimizePackageImports

  Creating an optimized production build ...



> Build error occurred
Error: Turbopack build failed with 4 errors:
./features/pos/components/SessionControl.tsx:913:9
Parsing ecmascript source code failed
  911 |                             maxOutboundAmount={currentSession.expected_cash}
  912 |                             onComplete={handleRegisterManualMovement}
> 913 |         </div>
      |         ^
  914 |     </BaseModal>
  915 |     <ActionConfirmModal
  916 |         open={closeSessionConfirm.isOpen}

Expression expected

Import traces:
  Client Component Browser:
    ./features/pos/components/SessionControl.tsx [Client Component Browser]
    ./app/pos/page.tsx [Client Component Browser]
    ./app/pos/page.tsx [Server Component]

  Client Component SSR:
    ./features/pos/components/SessionControl.tsx [Client Component SSR]
    ./app/pos/page.tsx [Client Component SSR]
    ./app/pos/page.tsx [Server Component]


./features/pos/components/SessionControl.tsx:913:10
Parsing ecmascript source code failed
  911 |                             maxOutboundAmount={currentSession.expected_cash}
  912 |                             onComplete={handleRegisterManualMovement}
> 913 |         </div>
      |          ^^^^^
  914 |     </BaseModal>
  915 |     <ActionConfirmModal
  916 |         open={closeSessionConfirm.isOpen}

Unterminated regexp literal

Import traces:
  Client Component Browser:
    ./features/pos/components/SessionControl.tsx [Client Component Browser]
    ./app/pos/page.tsx [Client Component Browser]
    ./app/pos/page.tsx [Server Component]

  Client Component SSR:
    ./features/pos/components/SessionControl.tsx [Client Component SSR]
    ./app/pos/page.tsx [Client Component SSR]
    ./app/pos/page.tsx [Server Component]


./components/selectors/UserSelector.tsx:15:1
Export AppUser doesn't exist in target module
  13 | import { useDebounce } from "@/hooks/use-debounce"
  14 | import { useUserSearch } from "@/features/users/hooks/useUserSearch"
> 15 | import { AppUser as User } from "@/types/entities"
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  16 |
  17 | interface UserSelectorProps {
  18 |     value?: number | null

The export AppUser was not found in module [project]/types/entities.ts [app-client] (ecmascript).
The module has no exports at all.
All exports of the module are statically known (It doesn't have dynamic exports). So it's known statically that the requested export doesn't exist.

Import traces:
  Client Component Browser:
    ./components/selectors/UserSelector.tsx [Client Component Browser]
    ./features/workflow/components/WorkflowSettings.tsx [Client Component Browser]
    ./features/workflow/components/WorkflowSettings.tsx [Server Component]
    ./app/(dashboard)/settings/workflow/page.tsx [Server Component]

  Client Component SSR:
    ./components/selectors/UserSelector.tsx [Client Component SSR]
    ./features/workflow/components/WorkflowSettings.tsx [Client Component SSR]
    ./features/workflow/components/WorkflowSettings.tsx [Server Component]
    ./app/(dashboard)/settings/workflow/page.tsx [Server Component]


./components/selectors/UserSelector.tsx:15:1
Export AppUser doesn't exist in target module
  13 | import { useDebounce } from "@/hooks/use-debounce"
  14 | import { useUserSearch } from "@/features/users/hooks/useUserSearch"
> 15 | import { AppUser as User } from "@/types/entities"
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  16 |
  17 | interface UserSelectorProps {
  18 |     value?: number | null

The export AppUser was not found in module [project]/types/entities.ts [app-ssr] (ecmascript).
The module has no exports at all.
All exports of the module are statically known (It doesn't have dynamic exports). So it's known statically that the requested export doesn't exist.

Import traces:
  Client Component Browser:
    ./components/selectors/UserSelector.tsx [Client Component Browser]
    ./features/workflow/components/WorkflowSettings.tsx [Client Component Browser]
    ./features/workflow/components/WorkflowSettings.tsx [Server Component]
    ./app/(dashboard)/settings/workflow/page.tsx [Server Component]

  Client Component SSR:
    ./components/selectors/UserSelector.tsx [Client Component SSR]
    ./features/workflow/components/WorkflowSettings.tsx [Client Component SSR]
    ./features/workflow/components/WorkflowSettings.tsx [Server Component]
    ./app/(dashboard)/settings/workflow/page.tsx [Server Component]


    at <unknown> (./features/pos/components/SessionControl.tsx:913:9)
    at <unknown> (./features/pos/components/SessionControl.tsx:913:10)
    at <unknown> (./components/selectors/UserSelector.tsx:15:1)
    at <unknown> (./components/selectors/UserSelector.tsx:15:1)
