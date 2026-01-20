/**
 * Centralized pricing utilities with consistent rounding
 * All monetary values in CLP (no decimals)
 */

const TAX_RATE = 0.19;

export const PricingUtils = {
    /**
     * Convierte precio NETO a BRUTO (con IVA)
     * @param net - Precio neto sin IVA
     * @returns Precio bruto con IVA (redondeado)
     */
    netToGross: (net: number): number => {
        return net * (1 + TAX_RATE);
    },

    grossToNet: (gross: number): number => {
        return gross / (1 + TAX_RATE);
    },

    calculateTax: (net: number): number => {
        return net * TAX_RATE;
    },

    roundFinal: (amount: number): number => {
        return Math.round(amount);
    },



    /**
     * Extrae el IVA desde el precio BRUTO
     * @param gross - Precio bruto con IVA
     * @returns Monto del IVA (redondeado)
     */
    extractTax: (gross: number): number => {
        const net = PricingUtils.grossToNet(gross);
        return gross - net;
    },

    /**
     * Calcula total de línea BRUTO (cantidad * precio neto * 1.19)
     * @param quantity - Cantidad
     * @param unitPriceNet - Precio unitario neto
     * @returns Total bruto de la línea (redondeado)
     */
    calculateLineTotal: (quantity: number, unitPriceNet: number): number => {
        const net = quantity * unitPriceNet;
        return PricingUtils.netToGross(net);
    },

    /**
     * Calcula total NETO de línea (cantidad * precio neto)
     * @param quantity - Cantidad
     * @param unitPriceNet - Precio unitario neto
     * @returns Total neto de la línea (redondeado)
     */
    calculateLineNet: (quantity: number, unitPriceNet: number): number => {
        return quantity * unitPriceNet;
    },

    /**
     * Aplica descuento porcentual a un precio
     * @param price - Precio original
     * @param discountPercent - Porcentaje de descuento (0-100)
     * @returns Precio con descuento aplicado (redondeado)
     */
    applyDiscount: (price: number, discountPercent: number): number => {
        return price * (1 - discountPercent / 100);
    },

    /**
     * Calcula el porcentaje de descuento entre dos precios
     * @param originalPrice - Precio original
     * @param discountedPrice - Precio con descuento
     * @returns Porcentaje de descuento (redondeado)
     */
    calculateDiscountPercent: (originalPrice: number, discountedPrice: number): number => {
        if (originalPrice === 0) return 0;
        return ((originalPrice - discountedPrice) / originalPrice) * 100;
    },

    /**
     * Calcula margen de ganancia porcentual
     * @param salePrice - Precio de venta (neto)
     * @param cost - Costo del producto
     * @returns Porcentaje de margen (redondeado)
     */
    calculateMargin: (salePrice: number, cost: number): number => {
        if (salePrice === 0) return 0;
        return Math.round((1 - (cost / salePrice)) * 100);
    },

    /**
     * Calcula precio de venta desde costo y margen deseado
     * @param cost - Costo del producto
     * @param marginPercent - Margen deseado (0-100)
     * @returns Precio de venta neto (redondeado)
     */
    calculatePriceFromMargin: (cost: number, marginPercent: number): number => {
        if (marginPercent >= 100) return 0;
        return cost / (1 - marginPercent / 100);
    },

    /**
     * Calcula totales de múltiples líneas
     * @param lines - Array de líneas con quantity y unit_price_net
     * @returns Objeto con net, tax y gross totales
     */
    calculateMultiLineTotal: (lines: Array<{ quantity: number; unit_price_net: number }>): {
        net: number;
        tax: number;
        gross: number;
    } => {
        const net = lines.reduce((acc, line) =>
            acc + PricingUtils.calculateLineNet(line.quantity, line.unit_price_net), 0
        );
        const tax = PricingUtils.calculateTax(net);
        const gross = net + tax;

        return { net, tax, gross };
    },

    /**
     * Formatea un valor monetario a string con separadores de miles
     * @param amount - Monto a formatear
     * @returns String formateado (ej: "1.234.567")
     */
    formatAmount: (amount: number): string => {
        return Math.round(amount).toLocaleString('es-CL');
    },

    /**
     * Formatea un valor monetario a string con símbolo de moneda
     * @param amount - Monto a formatear
     * @returns String formateado (ej: "$1.234.567")
     */
    formatCurrency: (amount: number): string => {
        return `$${PricingUtils.formatAmount(amount)}`;
    },

    /**
     * Calcula el precio para una unidad de medida porcentualmente
     * @param basePrice - Precio en la unidad base
     * @param baseRatio - Ratio de la unidad base
     * @param targetRatio - Ratio de la unidad de destino
     * @returns Precio calculado y redondeado
     */
    calculateUoMPrice: (basePrice: number, baseRatio: number, targetRatio: number): number => {
        if (!baseRatio || baseRatio === 0) return basePrice;
        const ratio = targetRatio / baseRatio;
        return basePrice * ratio;
    },
};
