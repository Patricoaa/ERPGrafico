"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useProduct } from "@/features/inventory/hooks/useProducts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { format } from "date-fns";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Form, FormField } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, User, X } from "lucide-react";
import type { WorkOrderFormValues, WorkOrderInitialData } from "@/types/forms";
import type { Contact } from "@/features/contacts/types";
import { useWizardStore } from "../WorkOrderWizardStore";
import type { ManufacturingData } from "@/components/shared/manufacturing";
import { ManufacturingSpecsEditor, emptyManufacturingData } from "@/components/shared/manufacturing";
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector";
import { UoMSelector } from "@/components/selectors/UoMSelector";
import { LabeledInput, LabeledContainer, PeriodValidationDateInput, SkeletonShell } from "@/components/shared";
import { workOrderSchema } from "@/types/forms";
import { productionApi } from "../../api/productionApi";
import { useAuth } from "@/contexts/AuthContext";
import { useVatRate } from "@/hooks/useVatRate";
import { useUoMs } from "../../hooks";
import { ManufacturingConfigSummary } from "./ManufacturingConfigSummary";
import type { WorkOrder } from "../../types";

interface ManufacturingConfigStepProps {
  initialData?: WorkOrderInitialData;
  onSuccess: (workOrderId: number) => void;
  formId?: string;
  onRestartComplete?: () => void;
  onCorrectionComplete?: (newOrderId: number) => void;
}

export function ManufacturingConfigStep({
  initialData,
  onSuccess,
  formId,
  onRestartComplete,
  onCorrectionComplete,
}: ManufacturingConfigStepProps) {
  const [loading, setLoading] = useState(false);

  // Get data from store
  const {
    chosenOtType,
    selectedSaleOrder: saleOrderId,
    selectedSaleLine: saleLineId,
    selectedProduct: selectedProductId,
    productDescription: productDescriptionFromStore,
    mfgConfig: mfgDataFromStore,
    selectedContact: selectedContactFromStore,
    quantity: quantityFromStore,
    uomId: uomIdFromStore,
    startDate: startDateFromStore,
    dueDate: dueDateFromStore,
    internalNotes: internalNotesFromStore,
    setSelectedContact,
    setQuantity: setQuantityStore,
    setUomId: setUomIdStore,
    setStartDate: setStartDateStore,
    setDueDate: setDueDateStore,
    setInternalNotes: setInternalNotesStore,
    setMfgConfig: setMfgConfigStore,
  } = useWizardStore();

  const otType = chosenOtType;

  const [mfgData, setMfgData] = useState<ManufacturingData>(
    mfgDataFromStore ?? emptyManufacturingData()
  );
  const [selectedContact, setSelectedContactLocal] = useState<Contact | null>(
    selectedContactFromStore
  );
  const [quantity, setQuantity] = useState<string>(
    otType === "LINKED" ? (quantityFromStore ?? "") : ""
  );
  const [uomId, setUomId] = useState<string>(
    otType === "LINKED" ? (uomIdFromStore ?? "") : ""
  );
  const [startDate, setStartDate] = useState<Date | null>(startDateFromStore);
  const [dueDate, setDueDate] = useState<Date | null>(dueDateFromStore);
  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);
  const pendingDataRef = useRef<WorkOrderFormValues | null>(null);
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    let result = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) { result += '-'; continue; }
      const r = Math.random() * 16 | 0;
      result += (i === 19 ? '4' : i === 14 ? '8' : r.toString(16));
    }
    return result;
  });

  const { user } = useAuth();
  const formIdValue = formId;
  const { multiplier: vatMultiplier, isLoading: isVatLoading } = useVatRate();
  const { data: uoms = [] } = useUoMs();

  // Fetch product details (UoM, mfg flags) when product is selected
  const { data: selectedProduct } = useProduct(
    otType === "NONE" && selectedProductId ? Number(selectedProductId) : null
  );

  const productForUoM = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      id: selectedProduct.id,
      name: selectedProduct.name,
      uom: selectedProduct.uom,
      category: selectedProduct.category_id,
      allowed_sale_uoms: selectedProduct.allowed_sale_uoms,
    };
  }, [selectedProduct]);

  // Set defaults from product when data arrives
  useEffect(() => {
    if (!selectedProduct) return;
    setMfgData(emptyManufacturingData({
      mfg_enable_prepress: selectedProduct.mfg_enable_prepress,
      mfg_enable_press: selectedProduct.mfg_enable_press,
      mfg_enable_postpress: selectedProduct.mfg_enable_postpress,
      mfg_prepress_design: selectedProduct.mfg_prepress_design,
      mfg_prepress_folio: selectedProduct.mfg_prepress_folio,
      mfg_press_offset: selectedProduct.mfg_press_offset,
      mfg_press_digital: selectedProduct.mfg_press_digital,
      mfg_press_special: selectedProduct.mfg_press_special,
    }));
    if (selectedProduct.uom && !uomId) {
      setUomId(String(selectedProduct.uom));
    }
  }, [selectedProduct]);

  // Initialize form with current values
  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderSchema) as unknown as SubmitHandler<WorkOrderFormValues>,
    defaultValues: {
      otType,
      description: otType === "LINKED" ? (productDescriptionFromStore ?? "") : "",
      sale_order: otType === "LINKED" ? (saleOrderId ?? "") : "",
      sale_line: otType === "LINKED" ? (saleLineId ?? "") : "",
      product_description: productDescriptionFromStore ?? "",
      product_id: otType === "NONE" ? (selectedProductId ?? "") : "",
      contact_id: selectedContact?.id?.toString() ?? "",
      quantity: otType === "NONE" ? (quantityFromStore ?? "") : "",
      uom_id: otType === "NONE" ? (uomIdFromStore ?? "") : "",
      start_date: startDate ?? new Date(),
      due_date: dueDate ?? null,
      internal_notes: "",
    } as WorkOrderFormValues,
  });

  // Load initial data if provided
  useEffect(() => {
    if (initialData) {
      const isLinked = !!initialData.sale_order;
      form.reset({
        otType: isLinked ? "LINKED" : "NONE",
        description: initialData.description || "",
        sale_order: isLinked ?
          (typeof initialData.sale_order === 'object' ?
            String(initialData.sale_order?.id || '') :
            String(initialData.sale_order || "")) : "",
        sale_line: isLinked ?
          (typeof initialData.sale_line === 'object' ?
            String(initialData.sale_line?.id || "") :
            String(initialData.sale_line || "")) : "",
        product_description: initialData.stage_data?.product_description ?? "",
        product_id: (!isLinked && initialData.product) ? String(initialData.product.id) : "",
        contact_id: initialData.stage_data?.contact_id?.toString() ?? "",
        quantity: isLinked ? "" : (initialData.stage_data?.quantity?.toString() ?? ""),
        uom_id: isLinked ? "" : (initialData.stage_data?.uom_id?.toString() ?? ""),
        start_date: initialData.start_date ?
          new Date(initialData.start_date) : new Date(),
        due_date: initialData.estimated_completion_date ?
          new Date(initialData.estimated_completion_date) :
          (initialData.sale_order_delivery_date ?
            new Date(initialData.sale_order_delivery_date) : null),
        internal_notes: initialData.stage_data?.internal_notes ?? "",
      } as WorkOrderFormValues);

      setMfgData({
        phases: {
          prepress: initialData.stage_data?.phases?.prepress ?? false,
          press: initialData.stage_data?.phases?.press ?? false,
          postpress: initialData.stage_data?.phases?.postpress ?? false,
        },
        specifications: {
          prepress: initialData.stage_data?.prepress_specs ?? "",
          press: initialData.stage_data?.press_specs ?? "",
          postpress: initialData.stage_data?.postpress_specs ?? "",
        },
        design_needed: initialData.stage_data?.design_needed ?? false,
        design_files: [],
        existing_design_files: initialData.stage_data?.design_attachments ?? [],
        folio_enabled: initialData.stage_data?.folio_enabled ?? false,
        folio_start: initialData.stage_data?.folio_start ?? '',
        print_type: (initialData.stage_data?.print_type as any) ?? null,
        internal_notes: initialData.stage_data?.internal_notes ?? '',
        product_description: initialData.stage_data?.product_description ?? '',
      });

      setSelectedContact({
        id: Number(initialData.stage_data?.contact_id),
        name: initialData.stage_data?.contact_name || "Contacto",
        tax_id: initialData.stage_data?.contact_tax_id || ""
      } as any);

      setQuantity(isLinked ? "" : (initialData.stage_data?.quantity?.toString() ?? ""));
      setUomId(isLinked ? "" : (initialData.stage_data?.uom_id?.toString() ?? ""));
      setStartDate(initialData.start_date ?
        new Date(initialData.start_date) : new Date());
      setDueDate(initialData.estimated_completion_date ?
        new Date(initialData.estimated_completion_date) :
        (initialData.sale_order_delivery_date ?
          new Date(initialData.sale_order_delivery_date) : null));
    }
  }, [initialData]);

  // Handle contact selection
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    form.setValue('contact_id', String(contact.id));
  };

  // Handle quantity change (only for MANUAL)
  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    form.setValue('quantity', value);
  };

  // Handle UoM change (only for MANUAL)
  const handleUomChange = (value: string) => {
    setUomId(value);
    form.setValue('uom_id', value);
  };

  // Handle manufacturing specs change
  const handleMfgChange = (next: ManufacturingData) => {
    setMfgData(next);
    form.setValue('product_description', next.product_description);
    form.setValue('internal_notes', next.internal_notes);
    form.setValue('description', next.product_description);
  };

  // Handle date changes
  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date);
    form.setValue('start_date', date ?? undefined);
  };

  const handleDueDateChange = (date: Date | null) => {
    setDueDate(date);
    form.setValue('due_date', date ?? undefined);
  };

  // Execute the actual API call (used both for direct update and after confirmation)
  const executeSubmit = async (data: WorkOrderFormValues) => {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('description', data.description || '');

      if (data.start_date) formData.append('start_date', format(data.start_date, 'yyyy-MM-dd'));
      if (data.due_date) formData.append('estimated_completion_date', format(data.due_date, 'yyyy-MM-dd'));
      if (selectedContact?.id) formData.append('related_contact', selectedContact.id.toString());

      if (data.otType === 'LINKED') {
        formData.append('sale_order', data.sale_order);
        formData.append('sale_line', data.sale_line);
        formData.append('stage_data', JSON.stringify({
          product_description: data.product_description,
          internal_notes: data.internal_notes,
          contact_id: selectedContact?.id,
          contact_name: selectedContact?.name,
          contact_tax_id: selectedContact?.tax_id,
          phases: mfgData.phases,
          specifications: mfgData.specifications,
          prepress_specs: mfgData.specifications.prepress,
          press_specs: mfgData.specifications.press,
          postpress_specs: mfgData.specifications.postpress,
          design_needed: mfgData.design_needed,
          folio_enabled: mfgData.folio_enabled,
          folio_start: mfgData.folio_start,
          print_type: mfgData.print_type,
          design_attachments: [...mfgData.existing_design_files, ...mfgData.design_files.map(f => f.name)],
          quantity: quantityFromStore ?? "",
          uom_id: uomIdFromStore ?? "",
        }));
      } else {
        formData.append('product_id', selectedProductId ?? "");
        formData.append('quantity', quantity);
        formData.append('uom_id', uomId);
        formData.append('stage_data', JSON.stringify({
          product_description: mfgData.product_description,
          internal_notes: mfgData.internal_notes,
          contact_id: selectedContact?.id,
          contact_name: selectedContact?.name,
          contact_tax_id: selectedContact?.tax_id,
          phases: mfgData.phases,
          specifications: mfgData.specifications,
          prepress_specs: mfgData.specifications.prepress,
          press_specs: mfgData.specifications.press,
          postpress_specs: mfgData.specifications.postpress,
          design_needed: mfgData.design_needed,
          folio_enabled: mfgData.folio_enabled,
          folio_start: mfgData.folio_start,
          print_type: mfgData.print_type,
          design_attachments: [...mfgData.existing_design_files, ...mfgData.design_files.map(f => f.name)],
          quantity,
          uom_id: uomId,
        }));
        formData.append('is_manual', 'true');
      }

      // Add design files
      mfgData.design_files.forEach((file, index) => {
        formData.append(`design_file_${index}`, file);
      });

      let workOrderId: number;
      if (initialData?.id) {
        await productionApi.updateWorkOrder(Number(initialData.id), formData);
        toast.success("Orden de Trabajo actualizada correctamente");
        workOrderId = Number(initialData.id);
      } else {
        const data = await productionApi.createWorkOrder(formData, {
          'Idempotency-Key': idempotencyKey
        });
        toast.success("Orden de Trabajo creada correctamente");
        workOrderId = (data as { id: number }).id;
      }

      onSuccess?.(workOrderId);
    } catch (error: unknown) {
      console.error("Error saving work order:", error);
      toast.error(getErrorMessage(error) || "Error al guardar la Orden de Trabajo");
    } finally {
      setLoading(false);
    }
  };

  // Submit handler: validate, then show confirmation for creation
  const onSubmit: SubmitHandler<WorkOrderFormValues> = async (data) => {
    if (loading) return;

    if (otType === "NONE" && (!quantity || quantity === "0")) {
      toast.error("La cantidad es requerida y debe ser mayor a cero");
      return;
    }

    if (otType === "NONE" && !uomId) {
      toast.error("La unidad de medida es requerida");
      return;
    }

    // Show confirmation dialog for creation (not update)
    if (!initialData?.id) {
      pendingDataRef.current = data;
      setIsCreateConfirmOpen(true);
      return;
    }

    await executeSubmit(data);
  };

  const handleConfirmCreate = async () => {
    setIsCreateConfirmOpen(false);
    if (pendingDataRef.current) {
      const data = pendingDataRef.current;
      pendingDataRef.current = null;
      await executeSubmit(data);
    }
  };

  // Post-creation: show granular summary instead of the creation form
  if (initialData?.id) {
    return (
      <ManufacturingConfigSummary
        order={initialData as unknown as WorkOrder}
        onSaved={() => onSuccess(Number(initialData.id))}
        onRestartComplete={onRestartComplete}
        onCorrectionComplete={onCorrectionComplete}
      />
    )
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    form.handleSubmit(onSubmit)(e)
  }

  return (
    <SkeletonShell isLoading={isVatLoading} ariaLabel="Cargando configuración de fabricación">
      <Form {...form}>
        <form id={formIdValue} onSubmit={handleFormSubmit} className="space-y-6 py-4">
          <fieldset>
            <div className="space-y-6">
              {/* Product info (read-only) */}
              {otType === "LINKED" ? (
                <div className="p-4 bg-muted/20 border rounded-lg">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Producto de la Nota de Venta
                  </Label>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Producto</p>
                        <p className="font-medium">{productDescriptionFromStore}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Cantidad</p>
                        <p className="font-medium">
                          {quantityFromStore ?? "0"}
                          {uomIdFromStore ?
                            (() => {
                              // We'd need to fetch the UoM name, but for now show the ID
                              return uomIdFromStore;
                            })() : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted/20 border rounded-lg">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Producto Seleccionado
                  </Label>
                  <div className="space-y-3 mt-2">
                    <div>
                      <p className="font-medium">{productDescriptionFromStore}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <LabeledInput
                        label="Cantidad a Fabricar"
                        type="number"
                        step="0.01"
                        min="0"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                      />
                      <UoMSelector
                        value={uomId}
                        onChange={handleUomChange}
                        uoms={uoms as any}
                        product={productForUoM as any}
                        context="sale"
                        variant="standalone"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <PeriodValidationDateInput
                      date={startDate ?? undefined}
                      onDateChange={handleStartDateChange}
                      label="Fecha Inicio"
                      validationType="tax"
                      required
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <PeriodValidationDateInput
                      date={dueDate ?? undefined}
                      onDateChange={handleDueDateChange}
                      label="Fecha Entrega"
                      validationType="tax"
                      required
                    />
                  )}
                />
              </div>

              {/* Contacto Relacionado */}
              <LabeledContainer label="Contacto Relacionado">
                {selectedContact ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-sm truncate">{selectedContact.name}</span>
                      {selectedContact.tax_id && (
                        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                          [{selectedContact.tax_id}]
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => {
                        setSelectedContact(null);
                        form.setValue('contact_id' as never, "" as never);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <AdvancedContactSelector
                    onSelectContact={handleContactSelect}
                    onChange={() => { }}
                    placeholder="Buscar contacto..."
                    variant="inline"
                    className="h-[1.5rem] px-0 border-none bg-transparent hover:bg-transparent shadow-none text-sm text-muted-foreground font-normal"
                  />
                )}
              </LabeledContainer>

              {/* Manufacturing Specs */}
              <ManufacturingSpecsEditor
                value={mfgData}
                onChange={handleMfgChange}
                showProductDescription={true}
                showInternalNotes={true}
                variant="inline"
              />
            </div>
          </fieldset>
        </form>
      </Form>

      <AlertDialog open={isCreateConfirmOpen} onOpenChange={setIsCreateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear Orden de Trabajo</AlertDialogTitle>
            <AlertDialogDescription>
              Una vez creada la OT no podrás modificar la configuración de fabricación
              ni volver a los pasos anteriores. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreate}>
              Crear orden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SkeletonShell>
  );
}