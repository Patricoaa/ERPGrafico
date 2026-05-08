import React from 'react';
import { Control, useController } from 'react-hook-form';
import { FieldSchema } from '../hooks/useSchema';
import { LabeledInput } from '@/components/shared/LabeledInput';
import { LabeledSelect } from '@/components/shared/LabeledSelect';
import { LabeledCheckbox } from '@/components/shared/LabeledCheckbox';
import { DatePicker } from '@/components/shared/DatePicker';

interface DynamicFieldProps {
    name: string;
    fieldDef: FieldSchema;
    control: Control<any>;
    error?: string;
}

export const DynamicField: React.FC<DynamicFieldProps> = ({ name, fieldDef, control, error }) => {
    const {
        field: { onChange, onBlur, value, ref },
    } = useController({
        name,
        control,
        defaultValue: fieldDef.type === 'boolean' ? false : '',
    });

    if (fieldDef.readonly) {
        return (
            <LabeledInput
                label={fieldDef.label}
                value={value ?? ''}
                readOnly
                disabled
                hint={fieldDef.help_text}
            />
        );
    }

    switch (fieldDef.type) {
        case 'string':
            return (
                <LabeledInput
                    label={fieldDef.label}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={error}
                    hint={fieldDef.help_text}
                    required={fieldDef.required}
                    maxLength={fieldDef.max_length}
                />
            );
        case 'text':
            return (
                <LabeledInput
                    as="textarea"
                    label={fieldDef.label}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={error}
                    hint={fieldDef.help_text}
                    required={fieldDef.required}
                    rows={3}
                />
            );
        case 'integer':
        case 'decimal':
            return (
                <LabeledInput
                    label={fieldDef.label}
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChange(val === '' ? null : Number(val));
                    }}
                    onBlur={onBlur}
                    error={error}
                    hint={fieldDef.help_text}
                    required={fieldDef.required}
                    step={fieldDef.type === 'decimal' ? 'any' : '1'}
                />
            );
        case 'boolean':
            return (
                <div className="pt-4">
                    <LabeledCheckbox
                        label={fieldDef.label}
                        checked={!!value}
                        onCheckedChange={(checked: boolean) => onChange(checked)}
                        description={fieldDef.help_text ?? ''}
                    />
                </div>
            );
        case 'enum':
            return (
                <LabeledSelect
                    label={fieldDef.label}
                    value={value ? String(value) : ''}
                    onChange={onChange}
                    options={fieldDef.choices?.map(c => ({ value: String(c.value), label: c.label })) || []}
                    error={error}
                    hint={fieldDef.help_text}
                    required={fieldDef.required}
                />
            );
        case 'date':
        case 'datetime':
            return (
                <div className="space-y-1 relative w-full group">
                    <fieldset
                        className={`notched-field transition-all duration-200 ${error ? 'border-destructive group-focus-within:border-destructive group-focus-within:ring-destructive/20' : 'group-focus-within:border-primary group-focus-within:ring-1 group-focus-within:ring-primary/20'}`}
                    >
                        <legend
                            className={`px-1.5 text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-200 ${error ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary'}`}
                        >
                            {fieldDef.label}
                            {fieldDef.required && <span className="text-destructive ml-0.5">*</span>}
                        </legend>
                        <div className="px-1 flex items-center h-full">
                            <DatePicker
                                date={value ? new Date(value) : undefined}
                                onDateChange={(d: Date | undefined) => onChange(d ? d.toISOString().split('T')[0] : null)}
                            />
                        </div>
                    </fieldset>
                    {error && <div className="text-[10px] font-medium text-destructive pl-1">{error}</div>}
                    {!error && fieldDef.help_text && <div className="text-[10px] text-muted-foreground pl-1">{fieldDef.help_text}</div>}
                </div>
            );
        // Fallback for foreign keys, m2m, files, etc.
        case 'fk':
            // As a placeholder for FK, just an input for ID or simple text if we don't have a specific widget yet.
            // In a real scenario, this would be an async select or generic search input.
            return (
                <LabeledInput
                    label={fieldDef.label + " (ID)"}
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChange(val === '' ? null : Number(val));
                    }}
                    onBlur={onBlur}
                    error={error}
                    hint={fieldDef.help_text || `FK a ${fieldDef.target}`}
                    required={fieldDef.required}
                />
            );
        default:
            return (
                <LabeledInput
                    label={fieldDef.label}
                    value={value ?? ''}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={error || `Tipo no soportado: ${fieldDef.type}`}
                    hint={fieldDef.help_text}
                    required={fieldDef.required}
                />
            );
    }
};
