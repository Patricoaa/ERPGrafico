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
            cardPlacement?: 'auto' | 'header-right' | 'center' | 'body'
        }>
    }
    /** Optional icon to render in the header */
    icon?: LucideIcon
    /** Optional class name for the icon */
    iconClassName?: string
    /** Optional actions to render in the header (usually from your actions factory) */
    actions?: React.ReactNode
    /** Optional default action to trigger when the card is clicked (used by keyboard/accessibility) */
    defaultAction?: ((e: React.MouseEvent) => void) | null
    /** Optional onClick handler for the entire card (takes precedence over defaultAction for the click target) */
    onClick?: () => void
    /** Whether the card is visually selected */
    isSelected?: boolean
    /** Additional CSS classes for the card container */
    className?: string
    /** Optional image URL to render in the header (takes precedence over icon) */
    imageSrc?: string
    /** Optional trailing slot to render in the header (e.g. badges, status) */
    trailing?: React.ReactNode
    /** Optional explicit title (overrides automatic selection from fields) */
    title?: React.ReactNode
    /** Optional explicit subtitle */
    subtitle?: React.ReactNode
    /** Optional center slot to render in the header */
    center?: React.ReactNode
    /** Optional children to render custom blocks like Metrics or Footer inside the card */
    children?: React.ReactNode
    /** Card display variant. Default is "auto" (heuristic). "compact" forces no body, "minimal" forces all to body and hides icon. */
    variant?: "auto" | "compact" | "minimal"
}

/**
 * AutoEntityCard - A standardized card component for Master Data entities.
 * 
 * Automatically generates the EntityCard layout using the fields defined in `createEntityFields`.
 * - If `title` is NOT provided, the first field is used as the Title, and the second as Subtitle.
 * - If `title` IS provided, all fields are evaluated for placement.
 * - Uses `cardPlacement` metadata ('header-right', 'center', 'body') to position fields.
 * - Fields with 'auto' placement use a heuristic: <= 2 fields go to header-right, >= 3 go to body.
 */
export function AutoEntityCard<TData>({ 
    data, 
    fields, 
    title,
    subtitle,
    center,
    icon, 
    iconClassName,
    actions, 
    defaultAction, 
    onClick,
    isSelected,
    className,
    imageSrc, 
    trailing,
    children,
    variant = "auto"
}: AutoEntityCardProps<TData>) {
    const cardFields = fields.toCardFields(data);
    
    const hasOverrideTitle = title !== undefined;
    const displayTitle = hasOverrideTitle ? title : (cardFields[0]?.value ?? '---');
    const displaySubtitle = hasOverrideTitle ? subtitle : cardFields[1]?.value;
    const restFields = hasOverrideTitle ? cardFields : cardFields.slice(2);

    // 1. Separate fields based on explicit placement
    const explicitHeaderRight = restFields.filter(f => f.cardPlacement === 'header-right');
    const explicitBody = restFields.filter(f => f.cardPlacement === 'body');
    const explicitCenter = restFields.filter(f => f.cardPlacement === 'center');
    const autoFields = restFields.filter(f => !f.cardPlacement || f.cardPlacement === 'auto');

    // 2. Apply heuristics for 'auto' fields
    let finalHeaderRight = [...explicitHeaderRight];
    let finalBody = [...explicitBody];

    if (variant === "compact") {
        // Force all auto fields to header-right (inline style)
        finalHeaderRight = [...finalHeaderRight, ...autoFields];
    } else if (variant === "minimal") {
        // Force all auto fields to body
        finalBody = [...finalBody, ...autoFields];
    } else {
        // Heuristic: If <= 2 auto fields, put them in header right. Else, put in body.
        if (autoFields.length <= 2) {
            finalHeaderRight = [...finalHeaderRight, ...autoFields];
        } else {
            finalBody = [...finalBody, ...autoFields];
        }
    }

    // 3. Build Header Right content
    const headerRightContent = finalHeaderRight.length > 0 && (
        <div className="flex items-center gap-4">
            {finalHeaderRight.map(f => (
                <div key={f.key} className="flex flex-col items-end">
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">{f.label}</span>
                    <span className="text-xs font-semibold">{f.value ?? <span className="opacity-40">—</span>}</span>
                </div>
            ))}
        </div>
    );

    const combinedTrailing = (headerRightContent || trailing) ? (
        <div className="flex items-center gap-4">
            {headerRightContent}
            {trailing}
        </div>
    ) : undefined;

    // 4. Build Center content from explicit prop or declarative fields
    const centerContent = center ?? (
        explicitCenter.length > 0
            ? explicitCenter.map(f => (
                <div key={f.key} className="text-xs text-muted-foreground line-clamp-2 text-center max-w-[400px]">
                    {f.value}
                </div>
            ))
            : undefined
    );

    // 5. Determine Card Variant (minimal padding if no body)
    const cardVariant = finalBody.length === 0 ? "compact" : "full";

    return (
        <EntityCard defaultAction={defaultAction} onClick={onClick} isSelected={isSelected} className={className} variant={cardVariant}>
            <EntityCard.Header 
                icon={variant === "minimal" ? undefined : icon}
                iconClassName={iconClassName}
                imageSrc={imageSrc}
                title={displayTitle} 
                subtitle={displaySubtitle} 
                center={centerContent}
                actions={actions}
                trailing={combinedTrailing}
            />
            {finalBody.length > 0 && (
                <EntityCard.Body>
                    {finalBody.map(field => (
                        <EntityCard.Field 
                            key={field.key} 
                            label={field.label} 
                            value={field.value} 
                        />
                    ))}
                </EntityCard.Body>
            )}
            {children}
        </EntityCard>
    );
}
