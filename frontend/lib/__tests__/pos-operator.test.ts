import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import api from "@/lib/api"
import {
    getPosOperatorHeaders,
    runPosOperatorChallenge,
    setPosOperatorChallengeHandler,
    setPosOperatorHeaders,
} from "@/lib/pos-operator"

afterEach(() => {
    setPosOperatorHeaders(null)
    setPosOperatorChallengeHandler(null)
})

describe("encabezados de operador", () => {
    it("devuelve solo los valores definidos", () => {
        expect(getPosOperatorHeaders()).toEqual({})
        setPosOperatorHeaders({ pass: "tok" })
        expect(getPosOperatorHeaders()).toEqual({ "X-POS-Operator-Pass": "tok" })
        setPosOperatorHeaders({ documentContext: 7 })
        expect(getPosOperatorHeaders()).toEqual({ "X-POS-Operator-Pass": "tok", "X-POS-Document-Context": "7" })
    })

    it("undefined quita solo esa clave y null limpia todo", () => {
        setPosOperatorHeaders({ pass: "tok", documentContext: 7 })
        setPosOperatorHeaders({ pass: undefined })
        expect(getPosOperatorHeaders()).toEqual({ "X-POS-Document-Context": "7" })
        setPosOperatorHeaders(null)
        expect(getPosOperatorHeaders()).toEqual({})
    })
})

describe("desafío de operador", () => {
    it("devuelve false sin manejador", async () => {
        expect(await runPosOperatorChallenge("DRAFT")).toBe(false)
    })

    it("entrega propósito y url al manejador y devuelve su resultado", async () => {
        const handler = vi.fn().mockResolvedValue(true)
        setPosOperatorChallengeHandler(handler)
        expect(await runPosOperatorChallenge("CASH_MOVEMENT", { url: "/x/" })).toBe(true)
        expect(handler).toHaveBeenCalledWith("CASH_MOVEMENT", { url: "/x/" })
    })
})

describe("interceptor de lib/api", () => {
    const original = api.defaults.adapter
    const calls: InternalAxiosRequestConfig[] = []

    function requiredError(config: InternalAxiosRequestConfig, purpose = "DRAFT") {
        return new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, null, {
            status: 403,
            statusText: "Forbidden",
            headers: {},
            config,
            data: { error: { code: "FORBIDDEN", status_code: 403, message: "x", details: { code: "pos_operator_required", purpose } } },
        })
    }

    beforeEach(() => {
        calls.length = 0
    })
    afterEach(() => {
        api.defaults.adapter = original
    })

    function useAdapter(failFirst: number) {
        api.defaults.adapter = async (config) => {
            calls.push(config)
            if (calls.length <= failFirst) throw requiredError(config)
            return { data: { ok: true }, status: 201, statusText: "Created", headers: {}, config }
        }
    }

    it("pide operador y reintenta una vez con el pase y una clave de idempotencia nueva", async () => {
        useAdapter(1)
        setPosOperatorChallengeHandler(async () => {
            setPosOperatorHeaders({ pass: "nuevo" })
            return true
        })
        const res = await api.post("/sales/pos-drafts/", {}, { headers: { "Idempotency-Key": "k1" } })
        expect(res.status).toBe(201)
        expect(calls).toHaveLength(2)
        expect(calls[1]!.headers.get("X-POS-Operator-Pass")).toBe("nuevo")
        expect(calls[1]!.headers.get("Idempotency-Key")).not.toBe("k1")
    })

    it("pasa propósito y url del request fallido al manejador", async () => {
        useAdapter(1)
        const handler = vi.fn().mockResolvedValue(true)
        setPosOperatorChallengeHandler(handler)
        await api.put("/sales/pos-drafts/12/", {})
        expect(handler).toHaveBeenCalledWith("DRAFT", { url: "sales/pos-drafts/12/" })
    })

    it("rechaza con el error original si el usuario cancela", async () => {
        useAdapter(1)
        setPosOperatorChallengeHandler(async () => false)
        await expect(api.post("/x/", {})).rejects.toMatchObject({ response: { status: 403 } })
        expect(calls).toHaveLength(1)
    })

    it("no reintenta más de una vez", async () => {
        useAdapter(5)
        const handler = vi.fn().mockResolvedValue(true)
        setPosOperatorChallengeHandler(handler)
        await expect(api.post("/x/", {})).rejects.toMatchObject({ response: { status: 403 } })
        expect(calls).toHaveLength(2)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it("no dispara el evento de permisos denegados", async () => {
        useAdapter(1)
        const onForbidden = vi.fn()
        window.addEventListener("auth:forbidden", onForbidden)
        setPosOperatorChallengeHandler(async () => false)
        await expect(api.post("/x/", {})).rejects.toBeTruthy()
        window.removeEventListener("auth:forbidden", onForbidden)
        expect(onForbidden).not.toHaveBeenCalled()
    })

    it("un 403 ordinario sigue siendo un 403 de permisos", async () => {
        api.defaults.adapter = async (config) => {
            throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, null, {
                status: 403, statusText: "Forbidden", headers: {}, config,
                data: { error: { code: "FORBIDDEN", details: {} } },
            })
        }
        const onForbidden = vi.fn()
        window.addEventListener("auth:forbidden", onForbidden)
        setPosOperatorChallengeHandler(async () => true)
        await expect(api.post("/x/", {})).rejects.toBeTruthy()
        window.removeEventListener("auth:forbidden", onForbidden)
        expect(onForbidden).toHaveBeenCalledTimes(1)
    })

    it("agrega los encabezados de operador a cada request", async () => {
        useAdapter(0)
        setPosOperatorHeaders({ pass: "p1", documentContext: 4 })
        await api.get("/x/")
        expect(calls[0]!.headers.get("X-POS-Operator-Pass")).toBe("p1")
        expect(calls[0]!.headers.get("X-POS-Document-Context")).toBe("4")
    })
})
