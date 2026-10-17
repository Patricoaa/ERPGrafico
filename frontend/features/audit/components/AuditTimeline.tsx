"use client";

import React, { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusBadge } from "@/components/shared";
import { cn, translateFieldName } from "@/lib/utils";
import { History, ChevronDown, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { type HistoricalRecord } from "@/types/audit";
import {
    resolveHistoryOperation,
    getChangedFields,
    formatHistoryValue,
    IGNORED_HISTORY_FIELDS
} from "@/features/audit/lib/history-display";

interface AuditTimelineProps {
    history: HistoricalRecord[];
    title?: string;
    ignoredFields?: string[];
}

export function AuditTimeline({
    history,
    title = "Historial de Cambios",
    ignoredFields = IGNORED_HISTORY_FIELDS
}: AuditTimelineProps) {
    const [expandedItems, setExpandedItems] = useState<number[]>([]);

    const toggleExpand = (id: number) => {
        setExpandedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                {history.length === 0 ? (
                    <EmptyState
                        variant="compact"
                        context="generic"
                        icon={History}
                        title="Sin actividad registrada"
                        description="Los cambios del registro aparecerán aquí."
                    />
                ) : (
                    <ScrollArea className="h-[500px] pr-4">
                        <ol reversed className="pb-2">
                            {history.map((item, index) => {
                                const operation = resolveHistoryOperation(item.history_type);
                                const isExpanded = expandedItems.includes(item.history_id);
                                const previous = history[index + 1]; // History is reversed (newest first)
                                const changedFields = getChangedFields(item, previous, ignoredFields);
                                const canExpand = item.history_type === '~' && changedFields.length > 0;
                                const isLast = index === history.length - 1;
                                const changesId = `audit-changes-${item.history_id}`;

                                return (
                                    <li key={item.history_id} className="flex gap-4">
                                        {/* Columna del marcador: badge + perforación vertical */}
                                        <div className="flex w-8 shrink-0 flex-col items-center">
                                            <StatusBadge
                                                variant="hub"
                                                size="md"
                                                icon={operation.icon}
                                                status={operation.status}
                                                intent={operation.intent}
                                            />
                                            {!isLast && (
                                                <span aria-hidden="true" className="w-0 flex-1 border-l border-dashed border-border/80" />
                                            )}
                                        </div>

                                        <div className={cn("flex-1 min-w-0 flex flex-col", !isLast && "pb-8")}>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="font-semibold text-sm text-foreground">
                                                    {operation.label} por {item.history_user_username || 'Sistema'}
                                                </span>
                                                <time
                                                    className="ml-auto text-xs text-muted-foreground/70"
                                                    title={new Date(item.history_date).toISOString()}
                                                >
                                                    {format(new Date(item.history_date), "dd MMM yyyy, HH:mm", { locale: es })}
                                                </time>
                                            </div>

                                            {item.history_change_reason && (
                                                <p className="mt-2 rounded-sm border border-border/60 bg-muted/40 p-2 text-xs italic text-muted-foreground">
                                                    &quot;{item.history_change_reason}&quot;
                                                </p>
                                            )}

                                            {item.history_type === '+' && changedFields.length === 0 && (
                                                <p className="mt-1 text-xs text-muted-foreground/80">
                                                    Registro inicial creado con todos los valores predeterminados.
                                                </p>
                                            )}

                                            {canExpand && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleExpand(item.history_id)}
                                                        aria-expanded={isExpanded}
                                                        aria-controls={changesId}
                                                        className="mt-1.5 -ml-1 h-auto w-fit gap-1 rounded-sm px-1 py-0.5 text-muted-foreground/70 hover:bg-transparent hover:text-foreground"
                                                    >
                                                        {isExpanded ? "Ocultar cambios" : `Ver ${changedFields.length} ${changedFields.length === 1 ? "cambio" : "cambios"}`}
                                                        <ChevronDown
                                                            aria-hidden="true"
                                                            className={cn("size-3 transition-transform duration-200 ease-premium", isExpanded && "rotate-180")}
                                                        />
                                                    </Button>

                                                    <div id={changesId} hidden={!isExpanded} className="mt-2">
                                                        <ul className="space-y-1.5 rounded-sm border border-border/60 bg-muted/40 p-2">
                                                            {changedFields.map(field => (
                                                                <li key={field} className="grid grid-cols-[auto_1fr] items-baseline gap-x-2">
                                                                    <span className="text-3xs font-medium text-muted-foreground/70 lowercase">
                                                                        {translateFieldName(field)}:
                                                                    </span>
                                                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                                        <span
                                                                            className="truncate font-mono text-2xs text-muted-foreground/70 line-through"
                                                                            title={formatHistoryValue(field, previous?.[field])}
                                                                        >
                                                                            {formatHistoryValue(field, previous?.[field])}
                                                                        </span>
                                                                        <ArrowRight aria-hidden="true" className="h-2.5 w-2.5 shrink-0 self-center text-muted-foreground/40" />
                                                                        <span
                                                                            className="min-w-0 break-words font-mono text-2xs font-medium text-foreground"
                                                                            title={formatHistoryValue(field, item[field])}
                                                                        >
                                                                            {formatHistoryValue(field, item[field])}
                                                                        </span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
