import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MentionTextView } from "../MentionTextView"

describe("MentionTextView", () => {
    it("renders tokens as named mentions", () => {
        render(
            <MentionTextView
                text="Hola @[u:3], revisa con @[g:9] y @[u:99]"
                mentions={[
                    { kind: "user", id: 3, name: "Bob" },
                    { kind: "team", id: 9, name: "Diseño" },
                ]}
            />,
        )
        expect(screen.getByText("@Bob")).toBeInTheDocument()
        expect(screen.getByText("@Diseño", { exact: false })).toBeInTheDocument()
        expect(screen.getByText("@desconocido")).toBeInTheDocument()
        expect(screen.queryByText(/@\[u:3\]/)).not.toBeInTheDocument()
    })
})
