"use client"

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import * as z from 'zod'
import { Form, FormField } from '@/components/ui/form'
import {
    Drawer, LabeledInput, LabeledSelect, FormSection, FormFooter,
    CancelButton, ActionSlideButton,
} from '@/components/shared'
import { AdvancedContactSelector } from '@/components/selectors/AdvancedContactSelector'
import { CheckSquare } from 'lucide-react'
import { useBanks } from '../hooks/useMasterData'
import { useCheckMutations } from './hooks'

const schema = z.object({
    bank: z.string().min(1, 'Banco es requerido'),
    check_number: z.string().min(1, 'N° de cheque requerido'),
    amount: z.string().min(1, 'Monto requerido'),
    issue_date: z.string().min(1, 'Fecha emisión requerida'),
    due_date: z.string().min(1, 'Fecha de cobro requerida'),
    counterparty: z.string().nullable().optional(),
    drawer_name: z.string().optional(),
    notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CheckRegisterDrawer({ open, onOpenChange }: Props) {
    const { banks } = useBanks()
    const { create, isCreating } = useCheckMutations()

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues: {
            bank: '', check_number: '', amount: '',
            issue_date: '', due_date: '',
            counterparty: null, drawer_name: '', notes: '',
        },
    })

    const onSubmit = async (values: FormValues) => {
        await create({
            bank: parseInt(values.bank),
            check_number: values.check_number,
            amount: values.amount,
            issue_date: values.issue_date,
            due_date: values.due_date,
            counterparty: values.counterparty ? parseInt(values.counterparty) : null,
            drawer_name: values.drawer_name ?? '',
            notes: values.notes ?? '',
        })
        form.reset()
        onOpenChange(false)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            title={
                <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-muted-foreground" />
                    <span>Registrar Cheque Recibido</span>
                </div>
            }
            subtitle="Ingresa los datos del cheque recibido de un cliente o tercero."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                loading={isCreating}
                                disabled={isCreating}
                                onClick={form.handleSubmit(onSubmit)}
                            >
                                Registrar en Cartera
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-4 pb-4 pt-2">
                    <FormSection title="Datos del Cheque" icon={CheckSquare} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="bank"
                            render={({ field, fieldState }) => (
                                <LabeledSelect
                                    label="Banco Emisor"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={fieldState.error?.message}
                                    options={(banks ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="check_number"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="N° de Cheque"
                                    placeholder="0001234"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Monto"
                                    placeholder="500000"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="issue_date"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Fecha de Emisión"
                                    type="date"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="due_date"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Fecha de Cobro / Vencimiento"
                                type="date"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />

                    <FormSection title="Girador" icon={CheckSquare} />
                    <FormField
                        control={form.control}
                        name="counterparty"
                        render={({ field }) => (
                            <AdvancedContactSelector
                                label="Cliente / Girador (opcional)"
                                value={field.value ?? null}
                                onChange={field.onChange}
                                placeholder="Buscar cliente..."
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="drawer_name"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Nombre Girador (si no es contacto del sistema)"
                                placeholder="Nombre libre"
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <LabeledInput
                                label="Notas"
                                as="textarea"
                                rows={2}
                                placeholder="Observaciones..."
                                {...field}
                            />
                        )}
                    />
                </form>
            </Form>
        </Drawer>
    )
}
