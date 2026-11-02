"use client"

import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { splitMentions } from "../lib/mentions"
import type { CommentMention } from "../types"

interface MentionTextProps {
    text: string
    mentions: CommentMention[]
    className?: string
}

/** Texto de comentario con los tokens `@[u:12]` / `@[g:3]` resueltos a nombres resaltados. */
export function MentionTextView({ text, mentions, className }: MentionTextProps) {
    return (
        <p className={cn("whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90", className)}>
            {splitMentions(text).map((segment, index) => {
                if (segment.type === "text") return <span key={index}>{segment.text}</span>
                const mention = mentions.find(m => m.kind === segment.kind && m.id === segment.id)
                return (
                    <span
                        key={index}
                        className="inline-flex items-baseline gap-0.5 rounded-sm bg-primary/10 px-0.5 font-semibold text-primary"
                    >
                        {segment.kind === "team" && <Users aria-hidden className="size-2.5 self-center" />}
                        @{mention?.name ?? "desconocido"}
                    </span>
                )
            })}
        </p>
    )
}
