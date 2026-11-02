import { describe, expect, it } from "vitest"
import {
    activeMentionQuery,
    decodeMentions,
    encodeMentions,
    insertMention,
    presentMentions,
    splitMentions,
} from "../mentions"
import type { CommentMention } from "../../types"

const ana: CommentMention = { kind: "user", id: 1, name: "Ana" }
const anabel: CommentMention = { kind: "user", id: 2, name: "Anabel Soto" }
const diseno: CommentMention = { kind: "team", id: 7, name: "Diseño" }

describe("mentions", () => {
    it("encodes chosen mentions to tokens without clobbering longer names", () => {
        expect(encodeMentions("hola @Anabel Soto y @Ana, ver @Diseño", [ana, anabel, diseno]))
            .toBe("hola @[u:2] y @[u:1], ver @[g:7]")
    })

    it("does not encode @Name that is a prefix of another word", () => {
        expect(encodeMentions("@Anas", [ana])).toBe("@Anas")
    })

    it("round-trips decode → encode", () => {
        const stored = "@[u:1] mira @[g:7]"
        const display = decodeMentions(stored, [ana, diseno])
        expect(display).toBe("@Ana mira @Diseño")
        expect(encodeMentions(display, [ana, diseno])).toBe(stored)
    })

    it("drops mentions removed from the text", () => {
        expect(presentMentions("solo @Ana", [ana, diseno])).toEqual([ana])
    })

    it("splits tokens into segments", () => {
        expect(splitMentions("a @[u:1] b")).toEqual([
            { type: "text", text: "a " },
            { type: "mention", kind: "user", id: 1 },
            { type: "text", text: " b" },
        ])
    })

    it("detects the active @query before the caret", () => {
        expect(activeMentionQuery("hola @an", 8)).toEqual({ start: 5, query: "an" })
        expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" })
        expect(activeMentionQuery("mail@dominio", 12)).toBeNull()
        expect(activeMentionQuery("hola @an tal", 12)).toBeNull()
    })

    it("inserts the chosen name replacing the query", () => {
        const active = { start: 5, query: "an" }
        expect(insertMention("hola @an!", active, "Ana")).toEqual({ text: "hola @Ana !", caret: 10 })
    })
})
