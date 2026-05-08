"use client";

import React from "react";
import { Control, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChildCollectionSchema } from "../hooks/useSchema";
import { DynamicField } from "./DynamicField";

interface ChildCollectionGridProps {
    /** The parent field array name, e.g. "lines" */
    fieldName: string;
    cc: ChildCollectionSchema;
    control: Control<any>;
    errors?: Record<string, any>;
}

const EMPTY_ROW = (fieldSchemas: ChildCollectionSchema["field_schemas"]) => {
    const row: Record<string, any> = {};
    for (const [key, def] of Object.entries(fieldSchemas)) {
        if (def.type === "boolean") row[key] = false;
        else if (def.type === "decimal" || def.type === "integer") row[key] = "";
        else row[key] = "";
    }
    return row;
};

export const ChildCollectionGrid: React.FC<ChildCollectionGridProps> = ({
    fieldName,
    cc,
    control,
    errors,
}) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: fieldName,
    });

    const cols = cc.columns.filter((c) => cc.field_schemas[c]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {cc.label}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => append(EMPTY_ROW(cc.field_schemas))}
                >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar línea
                </Button>
            </div>

            {fields.length === 0 ? (
                <div className="border border-dashed rounded-lg p-6 text-center text-xs text-muted-foreground">
                    Sin líneas. Haz clic en «Agregar línea» para comenzar.
                </div>
            ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                    {/* Header row */}
                    <div
                        className="grid bg-muted/30 border-b border-border/40 px-2 py-1.5 gap-2"
                        style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 2rem` }}
                    >
                        {cols.map((col) => (
                            <span key={col} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
                                {cc.field_schemas[col]?.label ?? col}
                            </span>
                        ))}
                        <span /> {/* delete column */}
                    </div>

                    {/* Data rows */}
                    {fields.map((row, idx) => (
                        <div
                            key={row.id}
                            className="grid items-center px-2 py-1.5 gap-2 border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
                            style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 2rem` }}
                        >
                            {cols.map((col) => (
                                <DynamicField
                                    key={col}
                                    name={`${fieldName}.${idx}.${col}`}
                                    fieldDef={cc.field_schemas[col]}
                                    control={control}
                                    error={errors?.[fieldName]?.[idx]?.[col]?.message}
                                />
                            ))}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => remove(idx)}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
