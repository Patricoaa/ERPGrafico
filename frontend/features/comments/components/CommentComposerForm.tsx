"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Paperclip, Send, ShieldAlert, Users } from "lucide-react"
import { Blobatar } from "@/components/ui/blobatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useMentionables } from "../hooks/useMentionables"
import {
    activeMentionQuery,
    decodeMentions,
    encodeMentions,
    insertMention,
    presentMentions,
    type ActiveMentionQuery,
} from "../lib/mentions"
import { COMMENT_FILE_EXTENSIONS, COMMENT_MAX_FILES, commentFormSchema } from "../schema"
import { CommentAttachmentsView } from "./CommentAttachmentsView"
import type { CommentFormValues, CommentMention, CommentTarget } from "../types"

/** Mensaje de un error de react-hook-form (los de `files` llegan por ítem o en la raíz). */
function errorMessage(value: unknown): string | undefined {
    if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
        return value.message
    }
    return undefined
}

interface MentionOption extends CommentMention {
    hint: string
    noAccess: boolean
}

interface CommentComposerFormProps {
    target: CommentTarget
    /** Recibe el texto con tokens `@[u:id]` y los adjuntos; resuelve cuando quedó guardado. */
    onSubmit: (text: string, files: File[]) => Promise<unknown>
    /** Botón de adjuntar archivos (no se ofrece al editar). */
    allowAttachments?: boolean
    onCancel?: () => void
    initialText?: string
    initialMentions?: CommentMention[]
    placeholder?: string
    submitLabel?: string
    autoFocus?: boolean
    className?: string
}

export function CommentComposerForm({
    target,
    onSubmit,
    onCancel,
    initialText = "",
    initialMentions = [],
    placeholder = "Escribe un comentario… usa @ para mencionar",
    submitLabel = "Comentar",
    autoFocus,
    allowAttachments = true,
    className,
}: CommentComposerFormProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [picked, setPicked] = useState<CommentMention[]>(initialMentions)
    const [active, setActive] = useState<ActiveMentionQuery | null>(null)
    const [highlight, setHighlight] = useState(0)

    const form = useForm<CommentFormValues>({
        resolver: zodResolver(commentFormSchema),
        defaultValues: { text: decodeMentions(initialText, initialMentions), files: [] },
    })
    const files = form.watch("files")
    const setFiles = (next: File[]) =>
        form.setValue("files", next, { shouldValidate: true })
    const { mentionables, loading } = useMentionables(active?.query ?? null, target)

    const options: MentionOption[] = [
        ...mentionables.users.map(u => ({
            kind: "user" as const,
            id: u.id,
            name: u.name,
            hint: `@${u.username}`,
            noAccess: u.has_access === false,
        })),
        ...mentionables.teams.map(t => ({
            kind: "team" as const,
            id: t.id,
            name: t.name,
            hint: `Equipo · ${t.member_count}`,
            noAccess: false,
        })),
    ]
    const open = active !== null && (options.length > 0 || loading)

    const textField = form.register("text")

    const syncActive = (el: HTMLTextAreaElement) => {
        setActive(activeMentionQuery(el.value, el.selectionStart ?? el.value.length))
        setHighlight(0)
    }

    const choose = (option: MentionOption) => {
        const el = textareaRef.current
        if (!el || !active) return
        const next = insertMention(el.value, active, option.name)
        form.setValue("text", next.text, { shouldValidate: form.formState.isSubmitted })
        setPicked(prev =>
            prev.some(m => m.kind === option.kind && m.id === option.id)
                ? prev
                : [...prev, { kind: option.kind, id: option.id, name: option.name }],
        )
        setActive(null)
        requestAnimationFrame(() => {
            el.focus()
            el.setSelectionRange(next.caret, next.caret)
        })
    }

    const submit = form.handleSubmit(async values => {
        try {
            await onSubmit(encodeMentions(values.text, presentMentions(values.text, picked)), values.files)
        } catch {
            return // El hook de mutación ya mostró el error; se conserva el borrador.
        }
        form.reset({ text: "", files: [] })
        setPicked([])
    })

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (open && options.length > 0) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                const step = e.key === "ArrowDown" ? 1 : -1
                setHighlight(h => (h + step + options.length) % options.length)
                return
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault()
                choose(options[Math.min(highlight, options.length - 1)])
                return
            }
        }
        if (e.key === "Escape") {
            if (open) {
                e.preventDefault()
                e.stopPropagation()
                setActive(null)
            } else if (onCancel) {
                e.preventDefault()
                e.stopPropagation()
                onCancel()
            }
            return
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            e.stopPropagation()
            void submit()
        }
    }

    const fileErrors: unknown = form.formState.errors.files
    const error =
        form.formState.errors.text?.message
        ?? errorMessage(fileErrors)
        ?? (Array.isArray(fileErrors) ? fileErrors.map(errorMessage).find(Boolean) : undefined)
    const submitting = form.formState.isSubmitting

    return (
        // Sin <form> nativo: el composer vive en rails que pueden estar dentro del <form> del
        // drawer, y un form anidado es HTML inválido (ADR-0111). El submit es explícito.
        <div role="form" aria-label="Nuevo comentario" className={cn("flex flex-col gap-1.5", className)}>
            <Popover open={open} onOpenChange={next => !next && setActive(null)}>
                <PopoverAnchor asChild>
                    <div className="relative">
                        <Textarea
                            {...textField}
                            ref={el => {
                                textField.ref(el)
                                textareaRef.current = el
                            }}
                            onChange={e => {
                                void textField.onChange(e)
                                syncActive(e.target)
                            }}
                            onClick={e => syncActive(e.currentTarget)}
                            onKeyDown={onKeyDown}
                            placeholder={placeholder}
                            autoFocus={autoFocus}
                            disabled={submitting}
                            aria-label="Comentario"
                            aria-invalid={!!error}
                            className={cn("min-h-[64px] resize-none bg-background text-xs", allowAttachments ? "pr-16" : "pr-9")}
                        />
                        {allowAttachments && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    hidden
                                    accept={COMMENT_FILE_EXTENSIONS.join(",")}
                                    aria-label="Archivos adjuntos"
                                    onChange={e => {
                                        const chosen = Array.from(e.target.files ?? [])
                                        if (chosen.length > 0) setFiles([...files, ...chosen])
                                        e.target.value = ""
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={submitting || files.length >= COMMENT_MAX_FILES}
                                    onClick={() => fileInputRef.current?.click()}
                                    aria-label="Adjuntar archivos"
                                    title={`Adjuntar archivos (máx. ${COMMENT_MAX_FILES}, 10 MB c/u)`}
                                    className="absolute bottom-1.5 right-9 size-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                >
                                    <Paperclip className="size-3.5" />
                                </Button>
                            </>
                        )}
                        <Button
                            type="button"
                            onClick={() => void submit()}
                            size="icon"
                            variant="ghost"
                            disabled={submitting}
                            aria-label={submitLabel}
                            aria-busy={submitting}
                            title={`${submitLabel} (Enter)`}
                            className="absolute bottom-1.5 right-1.5 size-7 hover:bg-primary/10 hover:text-primary"
                        >
                            <Send className={cn("size-3.5", submitting && "animate-pulse")} />

                        </Button>
                    </div>
                </PopoverAnchor>
                <PopoverContent
                    align="start"
                    side="bottom"
                    className="w-64 p-1"
                    onOpenAutoFocus={e => e.preventDefault()}
                    onCloseAutoFocus={e => e.preventDefault()}
                >
                    <ul role="listbox" aria-label="Mencionar" className="max-h-60 overflow-y-auto">
                        {options.length === 0 && (
                            <li className="px-2 py-1.5 text-2xs text-muted-foreground">Buscando…</li>
                        )}
                        {options.map((option, index) => (
                            <li
                                key={`${option.kind}-${option.id}`}
                                role="option"
                                aria-selected={index === highlight}
                                onMouseDown={e => {
                                    e.preventDefault()
                                    choose(option)
                                }}
                                onMouseEnter={() => setHighlight(index)}
                                className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
                                    index === highlight && "bg-muted",
                                )}
                            >
                                {option.kind === "team" ? (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-muted">
                                        <Users aria-hidden className="size-3 text-muted-foreground" />
                                    </span>
                                ) : (
                                    <Blobatar name={option.name} className="size-5" />
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-foreground">{option.name}</span>
                                    <span className="block truncate text-3xs text-muted-foreground">
                                        {option.noAccess ? "Sin acceso · no será notificado" : option.hint}
                                    </span>
                                </span>
                                {option.noAccess && (
                                    <ShieldAlert aria-label="Sin acceso a este registro" className="size-3.5 shrink-0 text-warning" />
                                )}
                            </li>
                        ))}
                    </ul>
                </PopoverContent>
            </Popover>
            {files.length > 0 && (
                <CommentAttachmentsView
                    attachments={files.map((file, index) => ({ key: `${file.name}-${index}`, name: file.name, size: file.size }))}
                    onRemove={index => setFiles(files.filter((_, i) => i !== index))}
                />
            )}
            {error && <p role="alert" className="text-3xs text-destructive">{error}</p>}
            {onCancel && (
                <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-2xs" onClick={onCancel}>
                        Cancelar
                    </Button>
                </div>
            )}
        </div>
    )
}
