"use client"

import React, { createContext, useContext } from "react"
import type { OrderLine } from "../../types"

interface OrderLineActionsContextValue {
    onCreateWorkOrder?: (line: OrderLine) => void
}

const OrderLineActionsContext = createContext<OrderLineActionsContextValue>({})

export function OrderLineActionsProvider({
    onCreateWorkOrder,
    children,
}: {
    onCreateWorkOrder?: (line: OrderLine) => void
    children: React.ReactNode
}) {
    return (
        <OrderLineActionsContext.Provider value={{ onCreateWorkOrder }}>
            {children}
        </OrderLineActionsContext.Provider>
    )
}

export function useOrderLineActions() {
    return useContext(OrderLineActionsContext)
}
