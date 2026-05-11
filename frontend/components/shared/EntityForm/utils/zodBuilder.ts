import { z } from 'zod';
import { EntitySchema } from '../hooks/useSchema';

export function buildZodSchema(schema: EntitySchema) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
        let fieldZod: z.ZodTypeAny;

        switch (fieldDef.type) {
            case 'string':
            case 'text':
                fieldZod = z.string();
                if (fieldDef.max_length) {
                    fieldZod = (fieldZod as z.ZodString).max(fieldDef.max_length, `Máximo ${fieldDef.max_length} caracteres`);
                }
                break;
            case 'integer':
                fieldZod = z.coerce.number().int();
                break;
            case 'decimal':
                fieldZod = z.coerce.number();
                break;
            case 'boolean':
                fieldZod = z.boolean();
                break;
            case 'date':
            case 'datetime':
                fieldZod = z.string();
                break;
            case 'enum':
                fieldZod = z.union([z.string(), z.number()]);
                break;
            case 'fk':
                fieldZod = z.union([z.number(), z.string()]);
                break;
            case 'm2m':
                fieldZod = z.array(z.union([z.number(), z.string()]));
                break;
            case 'json':
                fieldZod = z.any();
                break;
            case 'image':
            case 'file':
                fieldZod = z.any();
                break;
            default:
                fieldZod = z.any();
        }

        if (fieldDef.required) {
            if (fieldZod instanceof z.ZodString) {
                fieldZod = fieldZod.min(1, 'Este campo es requerido');
            }
        } else {
            fieldZod = fieldZod.optional().nullable();
        }

        shape[fieldName] = fieldZod;
    }

    return z.object(shape);
}
