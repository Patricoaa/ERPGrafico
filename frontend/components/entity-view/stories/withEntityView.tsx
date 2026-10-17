"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Decorator } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"
import { GlobalModalProvider } from "@/components/providers"
import { EntityViewProvider, type EntityOpener } from "@/components/entity-view"
import { getEntityMetadata } from "@/lib/entity-registry"
// App bootstrap equivalent: each feature registers its value kinds once (ADR-0087 §1).
import { registerDocumentValueKinds } from "@/features/documents/entity-view/docRef.kind"
import { registerInventoryValueKinds } from "@/features/inventory/entity-view/product.entity"

registerDocumentValueKinds()
registerInventoryValueKinds()

/** Logged in the Storybook actions panel. */
export const openEntityAction = fn().mockName("openEntity")

const opener: EntityOpener = {
    open: (label, id, row) => {
        openEntityAction(label, id, row)
    },
    labelOf: (label) => getEntityMetadata(label)?.titlePlural,
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

export const withEntityView: Decorator = (Story) => (
    <QueryClientProvider client={queryClient}>
        <GlobalModalProvider>
            <EntityViewProvider opener={opener}>
                <Story />
            </EntityViewProvider>
        </GlobalModalProvider>
    </QueryClientProvider>
)
