import { describe, it, expect, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { HeaderProvider, useHeader } from "@/components/providers/HeaderProvider"

const wrapper = ({ children }: { children: ReactNode }) => <HeaderProvider>{children}</HeaderProvider>
const salesSettings = { label: "Configuración de Ventas", open: () => {} }

describe("HeaderProvider — configuración del módulo", () => {
    beforeEach(() => window.history.pushState({}, "", "/sales/docs"))

    it("conserva settings del módulo cuando un PageHeader anidado no lo trae", () => {
        const { result } = renderHook(() => useHeader(), { wrapper })
        act(() => result.current.setHeader({ title: "Ventas", settings: salesSettings }))
        act(() => result.current.setHeader({ title: "Detalle" }))
        expect(result.current.moduleSettings?.moduleId).toBe("sales")
        expect(result.current.moduleSettings?.settings.label).toBe("Configuración de Ventas")
    })

    it("descarta settings al cambiar de módulo", () => {
        const { result } = renderHook(() => useHeader(), { wrapper })
        act(() => result.current.setHeader({ title: "Ventas", settings: salesSettings }))
        window.history.pushState({}, "", "/settings")
        act(() => result.current.setHeader({ title: "Configuración", navigation: { moduleName: "Configuración", moduleHref: "/settings", tabs: [], activeValue: "" } }))
        expect(result.current.moduleSettings).toBeNull()
    })
})
