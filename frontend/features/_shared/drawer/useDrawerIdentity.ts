"use client"

import React from "react"
import { getEntityMetadata, getEntityIcon, renderEntitySubtitle, renderEntitySubtitleSuffix } from "@/lib/entity-registry"
import { DrawerPrintButton } from "./DrawerPrintButton"
import type { DrawerMode } from "./types"
import type { ReactNode } from "react"

export interface DrawerIdentityData {
  id?: number | string
  [key: string]: unknown
}

export type DrawerIdentityInput = unknown

export interface UseDrawerIdentityOptions {
  /** Sobrescribe el género detectado desde EntityMetadata */
  feminine?: boolean
  /** Subtítulo estático (string o JSX). Si se omite, se usa un default según el modo */
  subtitle?: ReactNode
  /** Texto adicional appended al subtitle tras " · ". Anula subtitleSuffixTemplate del registry. */
  subtitleSuffix?: string
  /** Título completamente custom (anula la resolución automática) */
  customTitle?: string
  /** Icono custom (anula el del registry) */
  icon?: React.ComponentType<{ className?: string }>
  /** Si mostrar el botón de imprimir en headerActions (default: de ENTITY_REGISTRY) */
  printable?: boolean
  /** Callback para imprimir (requerido si printable es true) */
  onPrint?: () => void
}

function feminineArticle(feminine: boolean): string {
  return feminine ? 'de la' : 'del'
}

function formatEntityTitle(label: string, mode: DrawerMode, data?: DrawerIdentityInput, feminine?: boolean) {
  const meta = getEntityMetadata(label)
  const entityTitle = meta?.title ?? label.split('.').pop() ?? label
  const record = data as { id?: number | string } | null | undefined

  if (mode === 'create') {
    const prefix = feminine ? 'Nueva' : 'Nuevo'
    return `${prefix} ${entityTitle}`
  }

  if (mode === 'edit') {
    return `Editar ${entityTitle}`
  }

  const idStr = record?.id != null ? ` #${record.id}` : ''
  return `Ficha de ${entityTitle}${idStr}`
}

function formatDefaultSubtitle(mode: DrawerMode, label: string, feminine?: boolean) {
  const meta = getEntityMetadata(label)
  const entityTitle = meta?.title ?? label.split('.').pop() ?? label

  switch (mode) {
    case 'create':
      return `Ingrese los datos ${feminineArticle(feminine ?? false)} ${entityTitle.toLowerCase()}`
    case 'edit':
      return `Actualice la información ${feminineArticle(feminine ?? false)} ${entityTitle.toLowerCase()}`
    case 'view':
      return `Detalle ${feminineArticle(feminine ?? false)} ${entityTitle.toLowerCase()}`
  }
}

export function useDrawerIdentity(
  label: string,
  mode: DrawerMode,
  data?: DrawerIdentityInput,
  options?: UseDrawerIdentityOptions,
) {
  const meta = getEntityMetadata(label)

  const feminine = options?.feminine ?? meta?.feminine ?? false

  const title = options?.customTitle ?? formatEntityTitle(label, mode, data, feminine)

  const baseSubtitle = options?.subtitle ?? renderEntitySubtitle(label, data as Record<string, unknown> | null | undefined) ?? formatDefaultSubtitle(mode, label, feminine)
  const suffix = options?.subtitleSuffix ?? renderEntitySubtitleSuffix(label, data as Record<string, unknown> | null | undefined)
  const subtitle = suffix ? `${baseSubtitle} · ${suffix}` : baseSubtitle

  const IconComponent = options?.icon ?? getEntityIcon(label)

  const showPrint = options?.printable ?? meta?.printable ?? false
  const headerActions: ReactNode = showPrint && options?.onPrint
    ? React.createElement(DrawerPrintButton, { onPrint: options.onPrint })
    : undefined

  return {
    title,
    subtitle,
    icon: IconComponent,
    headerActions,
  }
}
