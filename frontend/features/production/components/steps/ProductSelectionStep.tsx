"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {FileText, X} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BaseProduct } from "@/features/inventory/types";
import { resolveMediaUrl } from '@/lib/api';
import { ProductSelector } from '@/components/shared';
import { useWorkOrderProducts } from "../../hooks/useWorkOrderProducts";

interface ProductSelectionStepProps {
  onChooseProduct: (
    otType: "LINKED" | "NONE",
    productId: string,
    quantity: string,
    uomId: string,
    productDescription: string
  ) => void;
  initialOtType?: "LINKED" | "NONE" | null;
  initialProductId?: string;
}

export function ProductSelectionStep({
  onChooseProduct,
  initialOtType,
  initialProductId
}: ProductSelectionStepProps) {
  const [otType, setOtType] = useState<"LINKED" | "NONE" | null>(
    initialOtType ?? null
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<BaseProduct | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useWorkOrderProducts(otType, searchTerm);

  const products = (data?.pages ?? []).flatMap(page => page.results ?? [])
    .filter(p => !p.mfg_auto_finalize);

  useEffect(() => {
    if (initialProductId && otType === "NONE" && !selectedProduct) {
      const found = products.find(p => p.id?.toString() === initialProductId);
      if (found) {
        requestAnimationFrame(() => setSelectedProduct(found))
      }
    }
  }, [initialProductId, otType, selectedProduct, products]);

  const handleProductSelect = (product: BaseProduct) => {
    setSelectedProduct(product);
    onChooseProduct(
      otType === "LINKED" ? "LINKED" : "NONE",
      product.id.toString(),
      "",
      product.uom?.toString() ?? "",
      product.name
    );
  };

  if (otType === null) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Seleccione el origen de fabricación primero</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="flex items-center justify-between mb-4">
      </div>

      <div className="flex flex-col flex-1 min-h-0">

        {isError ? (
          <div className="text-center py-6">
            <p className="text-destructive">Error al cargar productos</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {isLoading && products.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-8">
                <p className="text-muted-foreground">Cargando productos...</p>
              </div>
            ) : (
              <ProductSelector
                products={products}
                categories={[]}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelectCategory={() => { }}
                selectedCategoryId={null}
                onProductClick={handleProductSelect}
                priceRenderer={() => null}
              />
            )}
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="border-t pt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
{selectedProduct.image ? (
                                  <Image
                                    src={resolveMediaUrl(selectedProduct.image) ?? ""}
                                    alt={selectedProduct.name || ""}
                                    width={32}
                                    height={32}
                                    className="rounded object-cover"
                                  />
                ) : (
                  <div className="h-8 w-8 flex items-center justify-center rounded bg-muted/20">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Código: {selectedProduct.code}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSelectedProduct(null);
                  setSearchTerm("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Tipo</p>
                  <p className="font-medium">{selectedProduct.product_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Precio</p>
                  <p className="font-medium">{selectedProduct.sale_price} {selectedProduct.uom_name}</p>
                </div>
                {selectedProduct.qty_available !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Stock</p>
                    <p className="font-medium">{selectedProduct.qty_available}</p>
                  </div>
                )}
                {selectedProduct.manufacturable_quantity !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Fabricable</p>
                    <p className="font-medium">{selectedProduct.manufacturable_quantity}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
