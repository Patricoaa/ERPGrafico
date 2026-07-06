"use client"

import { getEntityMetadata, getEntityIcon } from "@/lib/entity-registry"
import type { DrawerMode } from "./types"

export interface DrawerIdentityData {
  id?: number | string
  [key: string]: unknown
}

export interface UseDrawerIdentityOptions {
  /** Sobrescribe el género detectado desde EntityMetadata */
  feminine?: boolean
  /** Subtítulo estático. Si se omite, se usa un default según el modo */
  subtitle?: string
  /** Título completamente custom (anula la resolución automática) */
  customTitle?: string
}

function feminineArticle(feminine: boolean): string {
  return feminine ? 'de la' : 'del'
}

function formatEntityTitle(label: string, mode: DrawerMode, data?: DrawerIdentityData | null, feminine?: boolean) {
  const meta = getEntityMetadata(label)
  const entityTitle = meta?.title ?? label.split('.').pop() ?? label

  if (mode === 'create') {
    const prefix = feminine ? 'Nueva' : 'Nuevo'
    return `${prefix} ${entityTitle}`
  }

  if (mode === 'edit') {
    return `Editar ${entityTitle}`
  }

  const idStr = data?.id != null ? ` #${data.id}` : ''
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
  data?: DrawerIdentityData | null,
  options?: UseDrawerIdentityOptions,
) {
  const meta = getEntityMetadata(label)

  const feminine = options?.feminine ?? meta?.feminine ?? false

  const title = options?.customTitle ?? formatEntityTitle(label, mode, data, feminine)

  const subtitle = options?.subtitle ?? meta?.description ?? formatDefaultSubtitle(mode, label, feminine)

  const IconComponent = getEntityIcon(label)

  return {
    title,
    subtitle,
    icon: IconComponent,
  }
}
