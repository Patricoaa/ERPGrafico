"use client";

import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { useSchema } from "./hooks/useSchema";
import { buildZodSchema } from "./utils/zodBuilder";
import { DynamicField } from "./components/DynamicField";
import { ChildCollectionGrid } from "./components/ChildCollectionGrid";

export interface EntityFormProps {
    /** Model label in format "app.model" — e.g. "accounting.budget" */
    modelLabel: string;
    /** If provided, the form loads existing data and PATCHes on submit */
    instanceId?: number;
    /** REST API base path — defaults to /<app>/<models_plural>/ derived from modelLabel */
    apiBasePath?: string;
    /** Called with the API response on success */
    onSuccess?: (data: unknown) => void;
    /** Called on cancel */
    onCancel?: () => void;
    /** Additional class for the form wrapper */
    className?: string;
}

export function deriveApiPath(modelLabel: string): string {
    const [app, model] = modelLabel.split(".");
    
    const irregulars: Record<string, string> = {
        'auditlog': 'auditlogs',
    };

    let pluralModel = model;
    
    if (irregulars[model]) {
        pluralModel = irregulars[model];
    } else if (model.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(model.charAt(model.length - 2))) {
        pluralModel = model.slice(0, -1) + 'ies';
    } else if (model.endsWith('s') || model.endsWith('x') || model.endsWith('z') || model.endsWith('ch') || model.endsWith('sh')) {
        pluralModel = model + 'es';
    } else {
        pluralModel = model + 's';
    }

    return `/${app}/${pluralModel}/`;
}

export const EntityForm: React.FC<EntityFormProps> = ({
    modelLabel,
    instanceId,
    apiBasePath,
    onSuccess,
    onCancel,
    className,
}) => {
    const queryClient = useQueryClient();
    const basePath = apiBasePath ?? deriveApiPath(modelLabel);
    const isEdit = instanceId !== undefined;

    const { data: schema, isLoading: schemaLoading, error: schemaError } = useSchema(modelLabel);

    const zodSchema = useMemo(
        () => (schema ? buildZodSchema(schema) : null),
        [schema],
    );

    const form = useForm({
        resolver: zodSchema ? zodResolver(zodSchema) : undefined,
        defaultValues: {},
    });

    // Load instance data in edit mode
    const { isLoading: instanceLoading } = useQuery({
        queryKey: [modelLabel, instanceId],
        queryFn: async () => {
            const { data } = await api.get(`${basePath}${instanceId}/`);
            form.reset(data);
            return data;
        },
        enabled: isEdit,
    });

    const mutation = useMutation({
        mutationFn: async (values: Record<string, unknown>) => {
            if (isEdit) {
                const { data } = await api.patch(`${basePath}${instanceId}/`, values);
                return data;
            }
            const { data } = await api.post(basePath, values);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [modelLabel] });
            onSuccess?.(data);
        },
    });

    const onSubmit = form.handleSubmit((values) => {
        mutation.mutate(values as Record<string, unknown>);
    });

    if (schemaLoading) {
        return (
            <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando formulario…
            </div>
        );
    }

    if (schemaError || !schema) {
        return (
            <div className="flex items-center gap-2 text-destructive text-sm p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No se pudo cargar el esquema de{" "}
                <code className="font-mono text-xs">{modelLabel}</code>.
            </div>
        );
    }

    const isLoading = schemaLoading || (isEdit && instanceLoading);
    const tabs = schema.ui_layout?.tabs ?? [
        { id: "main", label: "General", fields: Object.keys(schema.fields) },
    ];

    /** Reusable: render the content of a single tab */
    const renderTabContent = (tab: typeof tabs[number]) => {
        // Tab with child collection (line grid)
        if (tab.child_collection) {
            const cc = tab.child_collection;
            return (
                <ChildCollectionGrid
                    key={cc.related_name}
                    fieldName={cc.related_name}
                    cc={cc}
                    control={form.control}
                    errors={form.formState.errors}
                />
            );
        }
        // Standard field tab
        return (tab.fields ?? []).map((fieldName) => {
            const fieldDef = schema.fields[fieldName];
            if (!fieldDef) return null;
            return (
                <DynamicField
                    key={fieldName}
                    name={fieldName}
                    fieldDef={fieldDef}
                    control={form.control}
                    error={form.formState.errors[fieldName]?.message as string | undefined}
                />
            );
        });
    };

    return (
        <form onSubmit={onSubmit} className={className} noValidate>
            {tabs.length === 1 ? (
                <div className="space-y-4">
                    {renderTabContent(tabs[0])}
                </div>
            ) : (
                <Tabs defaultValue={tabs[0].id}>
                    <TabsList className="w-full justify-start mb-4">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {tabs.map((tab) => (
                        <TabsContent key={tab.id} value={tab.id} className="space-y-4 mt-0">
                            {renderTabContent(tab)}
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Error general del servidor */}
            {mutation.isError && (
                <div className="flex items-center gap-2 mt-4 text-destructive text-sm p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Error al guardar. Revisa los datos e intenta nuevamente.
                </div>
            )}

            <div className="flex items-center gap-2 justify-end mt-6 pt-4 border-t border-border/60">
                {onCancel && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        disabled={mutation.isPending}
                    >
                        Cancelar
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={mutation.isPending || isLoading}
                    className="gap-2"
                >
                    {mutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {isEdit ? "Guardar cambios" : "Crear"}
                </Button>
            </div>
        </form>
    );
};

export default EntityForm;
