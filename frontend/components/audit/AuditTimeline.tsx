"use client";

import React, { useState, useEffect } from "react";
import { HistoricalRecord } from "@/types/audit";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    History,
    User,
    Clock,
    PlusCircle,
    Edit,
    Trash2,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuditTimelineProps {
    history: HistoricalRecord[];
    title?: string;
    ignoredFields?: string[];
}

export function AuditTimeline({
    history,
    title = "Historial de Cambios",
    ignoredFields = ['history_id', 'history_date', 'history_change_reason', 'history_type', 'history_user_id', 'history_user_username', 'id', 'created_at', 'updated_at']
}: AuditTimelineProps) {
    const [expandedItems, setExpandedItems] = useState<number[]>([]);

    const toggleExpand = (id: number) => {
        setExpandedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getHistoryTypeInfo = (type: string) => {
        switch (type) {
            case '+':
                return {
                    icon: <PlusCircle className="h-4 w-4 text-green-500" />,
                    label: "Creación",
                    variant: "outline" as const,
                    color: "bg-green-100 text-green-700 border-green-200"
                };
            case '~':
                return {
                    icon: <Edit className="h-4 w-4 text-blue-500" />,
                    label: "Edición",
                    variant: "outline" as const,
                    color: "bg-blue-100 text-blue-700 border-blue-200"
                };
            case '-':
                return {
                    icon: <Trash2 className="h-4 w-4 text-red-500" />,
                    label: "Eliminación",
                    variant: "outline" as const,
                    color: "bg-red-100 text-red-700 border-red-200"
                };
            default:
                return {
                    icon: <History className="h-4 w-4 text-slate-500" />,
                    label: "Cambio",
                    variant: "outline" as const,
                    color: "bg-slate-100 text-slate-700 border-slate-200"
                };
        }
    };

    const findDiff = (current: HistoricalRecord, previous?: HistoricalRecord) => {
        if (!previous) return null;

        const diffs: { field: string; old: any; new: any }[] = [];

        Object.keys(current).forEach(key => {
            if (ignoredFields.includes(key)) return;

            if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
                diffs.push({
                    field: key,
                    old: previous[key],
                    new: current[key]
                });
            }
        });

        return diffs;
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
                <ScrollArea className="h-[500px] pr-4">
                    <div className="relative pl-6 border-l-2 border-slate-100 ml-3 space-y-8">
                        {history.map((item, index) => {
                            const info = getHistoryTypeInfo(item.history_type);
                            const isExpanded = expandedItems.includes(item.history_id);
                            const prevItem = history[index + 1]; // History is reversed (newest first)
                            const diffs = findDiff(item, prevItem);

                            return (
                                <div key={item.history_id} className="relative">
                                    {/* Dot */}
                                    <div className={`absolute -left-[31px] p-1 rounded-full bg-white border-2 ${info.color.includes('green') ? 'border-green-500' : info.color.includes('blue') ? 'border-blue-500' : 'border-red-500'}`}>
                                        {info.icon}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-sm">
                                                {info.label} por {item.history_user_username}
                                            </span>
                                            <Badge variant={info.variant} className={`text-[10px] px-1.5 py-0 h-5 ${info.color}`}>
                                                {info.label.toUpperCase()}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                                                <Clock className="h-3 w-3" />
                                                {format(new Date(item.history_date), "dd MMM yyyy, HH:mm", { locale: es })}
                                            </span>
                                        </div>

                                        {item.history_change_reason && (
                                            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded italic">
                                                "{item.history_change_reason}"
                                            </p>
                                        )}

                                        {diffs && diffs.length > 0 && (
                                            <div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs p-0 gap-1 text-muted-foreground hover:text-foreground"
                                                    onClick={() => toggleExpand(item.history_id)}
                                                >
                                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                    {isExpanded ? "Ocultar detalles" : `Ver ${diffs.length} cambios`}
                                                </Button>

                                                {isExpanded && (
                                                    <div className="mt-2 text-xs space-y-1 bg-slate-50/50 p-3 rounded-md border border-slate-100">
                                                        {diffs.map((d, i) => (
                                                            <div key={i} className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-1 last:border-0">
                                                                <span className="col-span-3 font-medium text-slate-500">{d.field}:</span>
                                                                <div className="col-span-9 flex items-center gap-2 flex-wrap">
                                                                    <span className="text-red-600 line-through decoration-red-300">
                                                                        {String(d.old ?? "n/a")}
                                                                    </span>
                                                                    <span className="text-muted-foreground">→</span>
                                                                    <span className="text-green-600 font-medium">
                                                                        {String(d.new ?? "n/a")}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {item.history_type === '+' && !diffs && (
                                            <p className="text-xs text-muted-foreground">
                                                Registro inicial creado con todos los valores predeterminados.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
