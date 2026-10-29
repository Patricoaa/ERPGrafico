"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { useSaleOrderSearch } from "@/features/orders";
import { useSaleOrderManufacturableLines } from "../../hooks/useSaleOrderManufacturableLines";
import { FileText, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, parseDateOnly } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import type { SaleOrderLine } from "@/features/sales";
import { resolveMediaUrl } from "@/lib/media-url";
import { getDomainConceptTitle } from "@/lib/entity-registry";
import { CardSurface, CardRow, CardRail, StepHeader } from "@/components/shared";

type ExpandedProduct = { id: number; name: string; code: string; image_thumbnail?: string; requires_advanced_manufacturing?: boolean };

// Safe: the API may return expanded product objects or plain IDs
function productOf(line: SaleOrderLine): ExpandedProduct | undefined {
  const p = line.product;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return p as ExpandedProduct;
  }
  return undefined;
}

interface ReadOnlyOrderInfo {
  number?: string | null;
  customer_name?: string;
  date?: string;
}

interface ReadOnlyLineInfo {
  product_name?: string;
  description?: string;
  quantity?: number;
  uom_name?: string;
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
  headerActions?: ReactNode;
  /** When true: hide the search bar and show only the already-selected OV and product. */
  readOnly?: boolean;
  /** Order display info for read-only mode (from WorkOrder.sale_order_number etc.). */
  readOnlyOrderInfo?: ReadOnlyOrderInfo;
  /** Line display info for read-only mode (from WorkOrder.sale_line). */
  readOnlyLineInfo?: ReadOnlyLineInfo;
}

const SEARCH_DEBOUNCE_MS = 300;

export function SaleOrderProductStep({
  onChooseProduct,
  initialOtType,
  initialSaleOrderId,
  initialSaleLineId,
  headerActions,
  readOnly = false,
  readOnlyOrderInfo,
  readOnlyLineInfo,
}: SaleOrderProductStepProps) {
  const [otType] = useState<"LINKED" | "NONE" | null>(
    initialOtType ?? null
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialSaleOrderId || null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(
    readOnly ? (initialSaleLineId ?? null) : null
  );
  const [search, setSearch] = useState<string>("");

  const { orders, loading, fetchOrders } = useSaleOrderSearch();

  // Fetch orders only in interactive mode
  useEffect(() => {
    if (readOnly) return;
    const handle = setTimeout(() => { void fetchOrders(search.trim()) }, search ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(handle);
  }, [search, fetchOrders, readOnly]);

  const { data: linesRaw = [], isLoading: loadingLines } = useSaleOrderManufacturableLines(
    selectedOrderId ? selectedOrderId : undefined,
    {
      enabled: !!selectedOrderId,
    }
  );

  // Interactive mode: show only lines without existing work orders.
  // Read-only mode: show all returned lines (the linked line may have work_order_summary).
  const availableLines = readOnly
    ? linesRaw
    : linesRaw.filter((line) => !line.work_order_summary);

  useEffect(() => {
    if (!selectedOrderId) {
      requestAnimationFrame(() => setSelectedLineId(null))
    }
  }, [selectedOrderId]);

  const handleOrderSelect = (orderId: string | null) => {
    if (readOnly) return;
    setSelectedOrderId(orderId ? String(orderId) : null);
    setSelectedLineId(null);
  };

  const handleLineSelect = (line: SaleOrderLine) => {
    if (readOnly) return;
    // product_id is always a plain number returned by SaleLineSerializer.
    // Falls back to line.product if it's a number/string or an expanded object.
    const productId =
      line.product_id?.toString() ??
      (typeof line.product === "number"
        ? line.product.toString()
        : typeof line.product === "string"
          ? line.product
          : productOf(line)?.id?.toString()) ??
      "";
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

  // Coming from a specific sale order line: continue with it once it is loaded (interactive only)
  const autoChosenRef = useRef(false);
  useEffect(() => {
    if (readOnly || autoChosenRef.current || !initialSaleLineId || loadingLines) return;
    const line = availableLines.find((l) => l.id?.toString() === initialSaleLineId);
    if (!line) return;
    autoChosenRef.current = true;
    requestAnimationFrame(() => handleLineSelect(line));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the preselected line appears
  }, [readOnly, initialSaleLineId, loadingLines, availableLines.length]);

  if (otType === null) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Seleccione el origen de fabricación primero</p>
      </div>
    );
  }

  // ── Read-only mode: show the already-linked OV and product without interaction ──
  if (readOnly) {
    const orderNumber = readOnlyOrderInfo?.number;
    const customerName = readOnlyOrderInfo?.customer_name;
    const orderDate = readOnlyOrderInfo?.date;

    // Prefer loaded line data over the minimal prop fallback
    const selectedLine = linesRaw.find((l) => l.id?.toString() === initialSaleLineId);
    const lineProd = selectedLine ? productOf(selectedLine) : undefined;
    const productName =
      selectedLine?.product_name ||
      lineProd?.name ||
      readOnlyLineInfo?.product_name ||
      "Producto";
    const productCode = selectedLine?.product_code || selectedLine?.code || lineProd?.code;
    const quantity = selectedLine?.quantity ?? readOnlyLineInfo?.quantity;
    const uomName = selectedLine?.uom_name || readOnlyLineInfo?.uom_name;
    const isAdvanced =
      selectedLine?.requires_advanced_manufacturing ??
      lineProd?.requires_advanced_manufacturing;
    const hasThumbnail = !!lineProd?.image_thumbnail;

    return (
      <div className="space-y-6">
        <StepHeader
          title={`Selección de ${getDomainConceptTitle('ov')} y Producto`}
          description={`${getDomainConceptTitle('ov')} y producto vinculados a esta ${getDomainConceptTitle('ot').toLowerCase()}.`}
          icon={FileText}
          rightContent={headerActions}
        />

        <div className="space-y-4">
          {/* Selected order */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {getDomainConceptTitle('ov')} vinculada
            </p>
            <CardSurface layout="inline" selected className="items-stretch">
              <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-foreground">
                    {orderNumber
                      ? `OV #${orderNumber}`
                      : initialSaleOrderId
                        ? `OV #${initialSaleOrderId}`
                        : getDomainConceptTitle('ov')}
                  </h3>
                  {orderDate && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {parseDateOnly(orderDate).toLocaleDateString('es-CL')}
                    </span>
                  )}
                </div>
                {customerName && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{customerName}</p>
                )}
              </div>
              <CardRail tone="primary" size="md" side="right">
                <FileText className="h-5 w-5" />
              </CardRail>
            </CardSurface>
          </div>

          {/* Selected product line */}
          {(selectedLine ?? readOnlyLineInfo) && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Producto a fabricar
              </p>
              <CardRow
                lead={
                  hasThumbnail && lineProd?.image_thumbnail ? (
                    <Image
                      src={resolveMediaUrl(lineProd.image_thumbnail) ?? ""}
                      alt={productName}
                      width={40}
                      height={40}
                      className="rounded object-cover"
                    />
                  ) : undefined
                }
                code={productCode ? `#${productCode}` : undefined}
                title={productName}
                description={
                  quantity !== undefined ? (
                    <span className="text-xs">
                      <span className="font-mono text-muted-foreground">Cant.:</span>{" "}
                      <span className="font-medium text-foreground">
                        {quantity} {uomName}
                      </span>
                    </span>
                  ) : undefined
                }
                trailing={
                  isAdvanced ? (
                    <span className="px-2 py-0.5 text-xs rounded bg-primary/[0.10] text-primary/80">
                      Fab. avanzada
                    </span>
                  ) : undefined
                }
                rail={
                  !hasThumbnail ? (
                    <CardRail tone="primary" size="md" side="right">
                      <Package className="h-5 w-5" />
                    </CardRail>
                  ) : undefined
                }
                selected
                unavailable={false}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Interactive mode ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <StepHeader
        title={`Selección de ${getDomainConceptTitle('ov')} y Producto`}
        description={`Seleccione la ${getDomainConceptTitle('ov').toLowerCase()} y el ítem a fabricar para vincular esta ${getDomainConceptTitle('ot').toLowerCase()}.`}
        icon={FileText}
        rightContent={headerActions}
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
                  const manufacturableLines = order.lines?.filter(
                    (line: { product_type?: string; requires_advanced_manufacturing?: boolean; work_order_summary?: unknown }) =>
                      line.product_type === 'MANUFACTURABLE' &&
                      line.requires_advanced_manufacturing &&
                      !line.work_order_summary
                  ) ?? [];

                  if (manufacturableLines.length === 0) return null;

                  const isSelected = selectedOrderId === String(order.id);
                  const totalAmount = order.lines?.reduce(
                    (sum: number, line: { quantity?: number; unit_price?: number }) =>
                      sum + ((line.quantity || 0) * (line.unit_price || 0)),
                    0
                  ) || 0;

                  return (
                    <CardSurface
                      key={order.id}
                      layout="inline"
                      selected={isSelected}
                      unavailable={false}
                      role="button"
                      onClick={() => handleOrderSelect(isSelected ? null : String(order.id))}
                      className="items-stretch"
                    >
                      <div className={cn("flex min-w-0 flex-1 flex-col gap-1 px-3 py-3")}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm text-foreground">
                            OV #{order.number}
                          </h3>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {order.date ? parseDateOnly(order.date).toLocaleDateString('es-CL') : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {order.customer?.name || "Cliente desconocido"}
                        </p>
                        <div className="flex items-center gap-2 text-xs mt-auto pt-1">
                          <span className="text-muted-foreground">
                            {manufacturableLines.length}{" "}
                            {manufacturableLines.length === 1 ? "línea fab." : "líneas fab."}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                      </div>
                      <CardRail tone={isSelected ? "primary" : "neutral"} size="md" side="right">
                        <FileText className="h-5 w-5" />
                      </CardRail>
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
                      const isLineSelected = selectedLineId === line.id?.toString();
                      const prod = productOf(line);
                      const productCode = line.product_code || line.code || prod?.code;
                      const isAdvanced = line.requires_advanced_manufacturing ?? prod?.requires_advanced_manufacturing;
                      const hasThumbnail = !!prod?.image_thumbnail;

                      return (
                        <CardRow
                          key={line.id}
                          lead={
                            hasThumbnail && prod?.image_thumbnail ? (
                              <Image
                                src={resolveMediaUrl(prod.image_thumbnail) ?? ""}
                                alt={prod.name || line.product_name || ""}
                                width={40}
                                height={40}
                                className="rounded object-cover"
                              />
                            ) : undefined
                          }
                          code={productCode ? `#${productCode}` : undefined}
                          title={line.product_name || line.description || "Producto sin nombre"}
                          description={
                            <span className="text-xs">
                              <span className="font-mono text-muted-foreground">Cant.:</span>{" "}
                              <span className="font-medium text-foreground">
                                {line.quantity} {line.uom_name}
                              </span>
                            </span>
                          }
                          trailing={
                            isAdvanced ? (
                              <span className="px-2 py-0.5 text-xs rounded bg-primary/[0.10] text-primary/80">
                                Fab. avanzada
                              </span>
                            ) : undefined
                          }
                          rail={
                            <CardRail
                              tone={isLineSelected ? "primary" : "neutral"}
                              size="md"
                              side="right"
                            >
                              {hasThumbnail
                                ? <FileText className="h-5 w-5" />
                                : <Package className="h-5 w-5" />
                              }
                            </CardRail>
                          }
                          selected={isLineSelected}
                          unavailable={false}
                          role="button"
                          onClick={() => handleLineSelect(line)}
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
