"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSaleOrderSearch } from "@/features/orders";
import { useSaleOrderManufacturableLines } from "../../hooks/useSaleOrderManufacturableLines";
import { FileText } from "lucide-react";
import { DataCell } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { cn, parseDateOnly } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import type { SaleOrderLine } from "@/features/sales";
import { resolveMediaUrl } from "@/lib/media-url";
import { getDomainConceptTitle } from "@/lib/entity-registry";
import { CardSurface, CardRow, GlyphChevron, StepHeader } from "@/components/shared";

type ExpandedProduct = { id: number; name: string; code: string; image_thumbnail?: string; requires_advanced_manufacturing?: boolean };

// Safe: the API always returns expanded product objects for manufacturable lines
function productOf(line: SaleOrderLine): ExpandedProduct | undefined {
  return line.product as unknown as ExpandedProduct | undefined;
}

interface SaleOrderProductStepProps {
  onChooseProduct: (
    otType: "LINKED" | "NONE",
    productId: string,
    quantity: string,
    uomId: string,
    productDescription: string,
    saleOrderId?: string,
    saleLineId?: string
  ) => void;
  initialOtType?: "LINKED" | "NONE" | null;
  /** Opened from a sale order ("Crear OT"): preselect it and, with a line, go on with it. */
  initialSaleOrderId?: string;
  initialSaleLineId?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

export function SaleOrderProductStep({
  onChooseProduct,
  initialOtType,
  initialSaleOrderId,
  initialSaleLineId,
}: SaleOrderProductStepProps) {
  const [otType] = useState<"LINKED" | "NONE" | null>(
    initialOtType ?? null
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialSaleOrderId || null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  const { orders, loading, fetchOrders } = useSaleOrderSearch();

  // Load the orders on open and follow the search box
  useEffect(() => {
    const handle = setTimeout(() => { void fetchOrders(search.trim()) }, search ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(handle);
  }, [search, fetchOrders]);

  const { data: lines = [], isLoading: loadingLines } = useSaleOrderManufacturableLines(
    selectedOrderId ? selectedOrderId : undefined,
    {
      enabled: !!selectedOrderId,
    }
  );

  // Filter lines to only those without existing work orders
  const availableLines = lines.filter(
    (line) => !line.work_order_summary
  );


  useEffect(() => {
    if (!selectedOrderId) {
      requestAnimationFrame(() => setSelectedLineId(null))
    }
  }, [selectedOrderId]);

  const handleOrderSelect = (orderId: string | null) => {
    setSelectedOrderId(orderId ? String(orderId) : null);
    setSelectedLineId(null);
  };

  const handleLineSelect = (line: SaleOrderLine) => {
    const productId = productOf(line)?.id?.toString() ?? "";
    if (!productId) return;

    setSelectedLineId(line.id?.toString() ?? null);

    // Auto-advance to manufacturing config after selecting product
    onChooseProduct(
      "LINKED",
      productId,
      String(line.quantity ?? ""),
      line.uom?.toString() ?? "",
      line.product_name || line.description || "",
      selectedOrderId ?? "",
      line.id?.toString() ?? ""
    );
  };

  // Coming from a specific sale order line: continue with it once it is loaded
  const autoChosenRef = useRef(false);
  useEffect(() => {
    if (autoChosenRef.current || !initialSaleLineId || loadingLines) return;
    const line = availableLines.find((l) => l.id?.toString() === initialSaleLineId);
    if (!line) return;
    autoChosenRef.current = true;
    requestAnimationFrame(() => handleLineSelect(line));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the preselected line appears
  }, [initialSaleLineId, loadingLines, availableLines.length]);

  if (otType === null) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Seleccione el origen de fabricación primero</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader
        title={`Selección de ${getDomainConceptTitle('ov')} y Producto`}
        description={`Seleccione la ${getDomainConceptTitle('ov').toLowerCase()} y el ítem a fabricar para vincular esta ${getDomainConceptTitle('ot').toLowerCase()}.`}
        icon={FileText}
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground mb-1">
            Buscar {getDomainConceptTitle('ov')}
          </label>
          <Input
            placeholder="Buscar por número, cliente o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Cargando órdenes de venta...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No se encontraron órdenes de venta. Intente con otro término de búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => {
                  // Check if this order has any manufacturable lines without work orders
                  const hasAvailableLines = order.lines?.some((line: { product_type?: string; requires_advanced_manufacturing?: boolean; work_order_summary?: unknown }) =>
                    line.product_type === 'MANUFACTURABLE' &&
                    line.requires_advanced_manufacturing &&
                    !line.work_order_summary
                  ) ?? false;

                  if (!hasAvailableLines) return null;

                  const isSelected = selectedOrderId === String(order.id);

                  return (
                    <CardSurface
                      key={order.id}
                      layout="inline"
                      selected={isSelected}
                      unavailable={false}
                      role="button"
                      onClick={() => handleOrderSelect(String(order.id))}
                      className="h-[120px]"
                    >
                      <div className="w-12 h-12 flex items-center justify-center rounded-sm bg-primary/10 flex-shrink-0">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className={cn("flex min-w-0 flex-1 flex-col gap-1 px-3 py-4", "inlineBody not defined, using inline styles")}>
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-lg text-foreground">
                            OV #{order.number}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {order.date ? parseDateOnly(order.date).toLocaleDateString('es-CL') : "—"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {order.customer?.name || "Cliente desconocido"}
                        </p>
                        <div className="flex items-center gap-3 text-sm mt-auto pt-2">
                          <span className="font-medium text-foreground">
                            {order.lines?.reduce((sum: number, line: { quantity?: number }) =>
                              sum + (line.quantity || 0), 0) || 0} productos
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(
                              order.lines?.reduce((sum: number, line: { quantity?: number; unit_price?: number }) =>
                                sum + ((line.quantity || 0) * (line.unit_price || 0)), 0) || 0
                            )}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 w-14 items-center justify-center">
                          <DataCell.Action
                            action="delete"
                            onClick={() => handleOrderSelect(null)}
                          />
                        </div>
                      )}
                    </CardSurface>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedOrderId && otType === "LINKED" && (
          <div className="border-t pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground mb-1">
                Seleccione el producto a fabricar
              </label>

              {loadingLines ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">Cargando productos disponibles...</p>
                </div>
              ) : (
                availableLines.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      No hay productos fabricables avanzados pendientes en esta {getDomainConceptTitle('ov').toLowerCase()}.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {availableLines.map((line) => {
                      const isSelected = selectedLineId === line.id?.toString();
                      const prod = productOf(line) as ExpandedProduct | undefined;

                      return (
                        <CardRow
                          key={line.id}
                          lead={
                            prod?.image_thumbnail ? (
                              <Image
                                src={resolveMediaUrl(prod.image_thumbnail) ?? ""}
                                alt={prod?.name || ""}
                                width={40}
                                height={40}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center rounded bg-muted/20">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )
                          }
                          code={prod?.code ? `#${prod.code}` : undefined}
                          title={line.product_name || line.description || "Producto sin nombre"}
                          description={
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-mono">Cant:</span>
                              <span className="font-medium text-foreground">
                                {line.quantity} {line.uom_name}
                              </span>
                            </div>
                          }
                          trailing={
                            prod?.requires_advanced_manufacturing && (
                              <span className="px-2 py-0.5 text-xs rounded bg-primary/[0.10] text-primary/80">
                                Fabricación avanzada
                              </span>
                            )
                          }
                          glyph={<GlyphChevron />}
                          selected={isSelected}
                          unavailable={false}
                          role="button"
                          onClick={() => handleLineSelect(line)}
                          className="h-[100px]"
                        />
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}