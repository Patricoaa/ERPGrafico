"use client";

import { useState, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FileText, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BaseProduct, ProductFilters } from "@/features/inventory/types";
import { ProductSelector } from "@/components/shared/ProductSelector";
import { inventoryApi } from "@/features/inventory/api/inventoryApi";

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
    data: pages = [],
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<BaseProduct[], Error>({
    queryKey: ["products", otType, searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      const filters: ProductFilters = {
        active: "true",
        can_be_sold: true,
        search: searchTerm,
        page_size: 20,
      };

      if (otType === "NONE") {
        filters.product_type = "MANUFACTURABLE";
      }

      return inventoryApi.getProducts({
        ...filters,
        page_size: 20,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined;
    },
    enabled: otType !== null,
  });

  const products = pages.flat();

  useEffect(() => {
    if (initialProductId && otType === "NONE" && !selectedProduct) {
      const found = products.find(p => p.id?.toString() === initialProductId);
      if (found) {
        setSelectedProduct(found);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Selección de Producto
        </h2>
        {otType === "NONE" && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setOtType(null);
              setSelectedProduct(null);
              setSearchTerm("");
            }}
          >
            Cambiar origen
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground mb-1">
            Buscar productos
          </label>
          <div className="relative">
            <Input
              placeholder="Buscar por nombre, código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -mt-2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {isError ? (
          <div className="text-center py-6">
            <p className="text-destructive">Error al cargar productos</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            {products.length === 0 && !isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No se encontraron productos. Intente con otro término de búsqueda.
                </p>
              </div>
            ) : (
              <ProductSelector
                products={products}
                categories={[]}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onProductClick={handleProductSelect}
                isProductDisabled={(product: BaseProduct) =>
                  otType === "NONE" &&
                  (product.requires_advanced_manufacturing || product.mfg_auto_finalize)
                }
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
                {selectedProduct.image_thumbnail ? (
                  <img
                    src={selectedProduct.image_thumbnail}
                    alt={selectedProduct.name || ""}
                    className="h-8 w-8 rounded object-cover"
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
                {selectedProduct.stock_available !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Stock</p>
                    <p className="font-medium">{selectedProduct.stock_available}</p>
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
