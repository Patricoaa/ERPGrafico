import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface FieldSchema {
    type: string;
    label: string;
    required?: boolean;
    readonly?: boolean;
    help_text?: string;
    choices?: { value: string | number; label: string }[];
    max_length?: number;
    max_digits?: number;
    decimal_places?: number;
    target?: string;
    limit_choices_to?: Record<string, any>;
    visible_if?: {
        field: string;
        equals?: any;
        in?: any[];
    };
}

export interface ChildCollectionSchema {
    related_name: string;
    model: string;
    label: string;
    columns: string[];
    field_schemas: Record<string, FieldSchema>;
    // future: api_base_path, readonly, etc.
}

export interface TabSchema {
    id: string;
    label: string;
    fields?: string[];
    child_collection?: ChildCollectionSchema;
}

export interface UILayout {
    tabs: TabSchema[];
}

export interface EntitySchema {
    label: string;
    verbose_name: string;
    verbose_name_plural: string;
    fields: Record<string, FieldSchema>;
    permissions: Record<string, string>;
    ui_layout: UILayout;
    actions: any[];
    transitions: Record<string, string[]>;
    icon?: string;
    list_url?: string;
    detail_url_pattern?: string;
}

export function useSchema(modelLabel: string) {
    return useQuery<EntitySchema>({
        queryKey: ['schema', modelLabel],
        queryFn: async () => {
            const { data } = await api.get(`/registry/${modelLabel}/schema/`);
            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutos cache
    });
}
