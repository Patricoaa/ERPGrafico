"use client"

import React from "react"
import { EntityCard } from "@/components/shared/EntityCard"
import type { LucideIcon } from "lucide-react"

export interface AutoEntityCardProps<TData> {
    /** The raw entity data */
    data: TData
    /** The fields factory returned by createEntityFields() */
    fields: {
        toCardFields: (data: TData, opts?: { only?: string[] }) => Array<{
            key: string
            label: string
            value: React.ReactNode
        }>
    }
    /** Optional icon to render in the header */
    icon?: LucideIcon
    /** Optional actions to render in the header (usually from your actions factory) */
    actions?: React.ReactNode
    /** Optional default action to trigger when the card is clicked */
    defaultAction?: ((e: React.MouseEvent) => void) | null
    /** Optional image URL to render in the header (takes precedence over icon) */
    imageSrc?: string
    /** Optional trailing slot to render in the header (e.g. badges, status) */
    trailing?: React.ReactNode
    /** Optional explicit title (overrides automatic selection from fields) */
    title?: React.ReactNode
    /** Optional explicit subtitle */
    subtitle?: React.ReactNode
}

/**
 * AutoEntityCard - A standardized card component for Master Data entities.
 * 
 * Automatically generates the EntityCard layout using the fields defined in `createEntityFields`.
 * - If `title` is NOT provided, the first field is used as the Title, and the second as Subtitle.
 * - If `title` IS provided, all fields are rendered in the Card Body.
 */
export function AutoEntityCard<TData>({ 
    data, 
    fields, 
    title,
    subtitle,
    icon, 
    actions, 
    defaultAction, 
    imageSrc, 
    trailing 
}: AutoEntityCardProps<TData>) {
    const cardFields = fields.toCardFields(data);
    
    const hasOverrideTitle = title !== undefined;
    const displayTitle = hasOverrideTitle ? title : (cardFields[0]?.value ?? '---');
    const displaySubtitle = hasOverrideTitle ? subtitle : cardFields[1]?.value;
    const restFields = hasOverrideTitle ? cardFields : cardFields.slice(2);

    return (
        <EntityCard defaultAction={defaultAction}>
            <EntityCard.Header 
                icon={icon}
                imageSrc={imageSrc}
                title={displayTitle} 
                subtitle={displaySubtitle} 
                actions={actions}
                trailing={trailing}
            />
            {restFields.length > 0 && (
                <EntityCard.Body>
                    {restFields.map(field => (
                        <EntityCard.Field 
                            key={field.key} 
                            label={field.label} 
                            value={field.value} 
                        />
                    ))}
                </EntityCard.Body>
            )}
        </EntityCard>
    );
}
