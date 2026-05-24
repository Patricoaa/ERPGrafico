"use client";

import { useState, useEffect } from "react";
import { useSaleOrderSearch } from "@/features/orders/hooks/useSaleOrderSearch";
import { useSaleOrderManufacturableLines } from "../../hooks/useSaleOrderManufacturableLines";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import type { SaleOrderLine } from "@/features/sales/types";

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
}

export function SaleOrderProductStep({
  onChooseProduct,
  initialOtType
}: SaleOrderProductStepProps) {
  const [otType, setOtType] = useState<"LINKED" | "NONE" | null>(
    initialOtType ?? null
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  const { orders, loading } = useSaleOrderSearch();

  const { data: lines = [], isLoading: loadingLines } = useSaleOrderManufacturableLines(
    selectedOrderId ? selectedOrderId : undefined,
    {
      enabled: !!selectedOrderId,
      // We'll filter manually below to show only lines without work orders
    }
  );

  // Filter lines to only those without existing work orders
  const availableLines = lines.filter(
    (line) => !line.work_order_summary
  );

  // Group lines by product for display (we want to show unique products)
  const productsById = new Map<string, SaleOrderLine & { quantity: number; uom_name: string }>();
  availableLines.forEach(line => {
    const productKey = line.product?.id?.toString() ?? "";
    if (!productKey) return;

    const existing = productsById.get(productKey);
    if (!existing || (line.quantity ?? 0) > (existing.quantity ?? 0)) {
      // Keep the line with highest quantity for this product (or first if equal)
      productsById.set(productKey, {
        ...line,
        quantity: line.quantity ?? 0,
        uom_name: line.uom_name ?? ""
      });
    }
  });

  const availableProducts = Array.from(productsById.values());

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedLineId(null);
    }
  }, [selectedOrderId]);

  const handleOrderSelect = (orderId: string | null) => {
    setSelectedOrderId(orderId ? String(orderId) : null);
    setSelectedLineId(null);
  };

  const handleProductSelect = (productId: string) => {
    const line = availableLines.find(l =>
      l.product?.id?.toString() === productId
    );

    if (!line) return;

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

  if (otType === null) {
    // This shouldn't happen in this step, but just in case
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Seleccione el origen de fabricación primero</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground mb-1">
            Buscar Nota de Venta
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
            <p className="text-muted-foreground">Cargando notas de venta...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No se encontraron notas de venta. Intente con otro término de búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => {
                  // Check if this order has any manufacturable lines without work orders
                  const hasAvailableLines = order.lines?.some((line: any) =>
                    line.product_type === 'MANUFACTURABLE' &&
                    line.requires_advanced_manufacturing &&
                    !line.work_order_summary
                  ) ?? false;

                  if (!hasAvailableLines) return null;

                  return (
                    <Button
                      key={order.id}
                      type="button"
                      variant="outline"
                      className={cn(
                        "group flex h-[120px] w-full rounded-xl border border-border/30",
                        selectedOrderId === String(order.id) &&
                        "border-primary/50 bg-primary/[0.03]",
                        "hover:border-primary/50 hover:bg-primary/[0.03] transition-all duration-300"
                      )}
                      onClick={() => handleOrderSelect(String(order.id))}
                    >
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-opacity pointer-events-none" />
                      <div className="flex h-full w-full p-6 space-x-4">
                        <div className="flex-shrink-0">
                          <FileText className="h-6 w-6 text-primary/80 group-hover:text-primary" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-lg text-foreground">
                              NV #{order.number}
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.date || 0).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {order.customer?.name || "Cliente desconocido"}
                          </p>

                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium text-foreground">
                              {order.lines?.reduce((sum: number, line: any) =>
                                sum + (line.quantity || 0), 0) || 0} productos
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(
                                order.lines?.reduce((sum: number, line: any) =>
                                  sum + ((line.quantity || 0) * (line.unit_price || 0)), 0) || 0
                              )}
                            </span>
                          </div>
                        </div>
                        {selectedOrderId === String(order.id) && (
                          <div className="flex-shrink-0 space-y-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOrderSelect(null);
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Button>
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
                availableProducts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      No hay productos fabricables avanzados pendientes en esta nota de venta.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {availableProducts.map((line) => {
                      const isSelected = selectedLineId === line.id?.toString();

                      return (
                        <Button
                          key={line.id}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "flex h-[100px] w-full rounded-lg border border-border/30",
                            isSelected && "border-primary bg-primary/[0.10]",
                            "hover:border-primary/50 hover:bg-primary/[0.03] transition-all duration-300"
                          )}
                          onClick={() => handleProductSelect(line.product?.id?.toString() ?? "")}
                        >
                          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-opacity pointer-events-none" />
                          <div className="flex h-full w-full p-4 space-x-3">
                            <div className="flex-shrink-0">
                              {line.product?.image_thumbnail ? (
                                <img
                                  src={line.product.image_thumbnail}
                                  alt={line.product?.name || ""}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 flex items-center justify-center rounded bg-muted/20">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex-col space-y-2">
                              <div className="flex justify-between items-start">
                                <h3 className="font-semibold text-lg text-foreground">
                                  {line.product_name || line.description || "Producto sin nombre"}
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                  #{line.product?.code}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-mono">Cant:</span>
                                <span className="font-medium text-foreground">
                                  {line.quantity} {line.uom_name}
                                </span>
                              </div>

                              {line.product?.requires_advanced_manufacturing && (
                                <span className="px-2 py-0.5 text-xs rounded bg-primary/[0.10] text-primary/80">
                                  Fabricación avanzada
                                </span>
                              )}
                            </div>
                          </div>
                        </Button>
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