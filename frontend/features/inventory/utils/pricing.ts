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
        const roundedNet = Math.round(net);
        const tax = Math.round(roundedNet * TAX_RATE);
        return roundedNet + tax;
    },

    /**
     * Convierte precio BRUTO a NETO (sin IVA)
     * @param gross - Precio bruto con IVA
     * @returns Precio neto sin IVA (redondeado)
     */
    grossToNet: (gross: number): number => {
        return Math.round(gross / (1 + TAX_RATE));
    },

    /**
     * Calcula el IVA desde el precio NETO
     * @param net - Precio neto sin IVA
     * @returns Monto del IVA (redondeado)
     */
    calculateTax: (net: number): number => {
        return Math.round(net * TAX_RATE);
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
        const net = Math.round(quantity * unitPriceNet);
        return PricingUtils.netToGross(net);
    },

    /**
     * Calcula total NETO de línea (cantidad * precio neto)
     * @param quantity - Cantidad
     * @param unitPriceNet - Precio unitario neto
     * @returns Total neto de la línea (redondeado)
     */
    calculateLineNet: (quantity: number, unitPriceNet: number): number => {
        return Math.round(quantity * unitPriceNet);
    },

    /**
     * Aplica descuento porcentual a un precio
     * @param price - Precio original
     * @param discountPercent - Porcentaje de descuento (0-100)
     * @returns Precio con descuento aplicado (redondeado)
     */
    applyDiscount: (price: number, discountPercent: number): number => {
        return Math.round(price * (1 - discountPercent / 100));
    },

    /**
     * Calcula el porcentaje de descuento entre dos precios
     * @param originalPrice - Precio original
     * @param discountedPrice - Precio con descuento
     * @returns Porcentaje de descuento (redondeado)
     */
    calculateDiscountPercent: (originalPrice: number, discountedPrice: number): number => {
        if (originalPrice === 0) return 0;
        return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
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
        return Math.round(cost / (1 - marginPercent / 100));
    },

    /**
     * Calcula el monto de descuento desde un porcentaje
     * @param total - Monto total (bruto o neto)
     * @param percent - Porcentaje 
     */
    calculateDiscountAmount: (total: number, percent: number): number => {
        return Math.round(total * (percent / 100));
    },

    /**
     * Calcula totales de línea desde precio BRUTO (para evitar discrepancias)
     * @param quantity - Cantidad
     * @param unitPriceGross - Precio unitario bruto (con IVA)
     * @returns Objeto con gross, net y tax de la línea
     */
    calculateLineFromGross: (quantity: number, unitPriceGross: number, discountAmount: number = 0): {
        gross: number;
        net: number;
        tax: number;
    } => {
        const totalGross = Math.round(quantity * unitPriceGross);
        const gross = Math.max(0, totalGross - discountAmount);
        const net = Math.round(gross / (1 + TAX_RATE));
        const tax = gross - net;
        return { gross, net, tax };
    },

    /**
     * Calcula totales de múltiples líneas (ahora soporta base BRUTA)
     * @param lines - Array de líneas con quantity y precio (neto o bruto)
     * @param useGross - Si es true, usa unit_price_gross como base
     * @returns Objeto con net, tax y gross totales
     */
    calculateMultiLineTotal: (lines: Array<{ quantity: number; unit_price_net?: number; unit_price_gross?: number }>, useGross = false): {
        net: number;
        tax: number;
        gross: number;
    } => {
        if (useGross) {
            const gross = lines.reduce((acc, line) =>
                acc + Math.round(line.quantity * (line.unit_price_gross || 0)), 0
            );
            const net = Math.round(gross / (1 + TAX_RATE));
            const tax = gross - net;
            return { net, tax, gross };
        } else {
            const net = lines.reduce((acc, line) =>
                acc + PricingUtils.calculateLineNet(line.quantity, line.unit_price_net || 0), 0
            );
            const tax = Math.ceil(net * TAX_RATE);
            const gross = net + tax;
            return { net, tax, gross };
        }
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
        return Math.round(basePrice * ratio);
    },
};
