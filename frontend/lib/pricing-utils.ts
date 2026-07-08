import { formatCurrency as canonicalFormatCurrency } from "@/lib/money";

export const PricingUtils = {
    netToGross: (net: number, taxRate: number = 0.19): number => {
        const roundedNet = Math.round(net);
        const tax = Math.round(roundedNet * taxRate);
        return roundedNet + tax;
    },

    grossToNet: (gross: number, taxRate: number = 0.19): number => {
        return Math.round(gross / (1 + taxRate));
    },

    calculateTax: (net: number, taxRate: number = 0.19): number => {
        return Math.round(net * taxRate);
    },

    extractTax: (gross: number, taxRate: number = 0.19): number => {
        const net = PricingUtils.grossToNet(gross, taxRate);
        return gross - net;
    },

    calculateLineTotal: (quantity: number, unitPriceNet: number, taxRate: number = 0.19): number => {
        const net = Math.round(quantity * unitPriceNet);
        return PricingUtils.netToGross(net, taxRate);
    },

    calculateLineNet: (quantity: number, unitPriceNet: number): number => {
        return Math.round(quantity * unitPriceNet);
    },

    applyDiscount: (price: number, discountPercent: number): number => {
        return Math.round(price * (1 - discountPercent / 100));
    },

    calculateDiscountPercent: (originalPrice: number, discountedPrice: number): number => {
        if (originalPrice === 0) return 0;
        return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
    },

    calculateMargin: (salePrice: number, cost: number): number => {
        if (salePrice === 0) return 0;
        return Math.round((1 - (cost / salePrice)) * 100);
    },

    calculatePriceFromMargin: (cost: number, marginPercent: number): number => {
        if (marginPercent >= 100) return 0;
        return Math.round(cost / (1 - marginPercent / 100));
    },

    calculateDiscountAmount: (total: number, percent: number): number => {
        return Math.round(total * (percent / 100));
    },

    calculateLineFromGross: (quantity: number, unitPriceGross: number, discountAmount: number = 0, taxRate: number = 0.19): {
        gross: number;
        net: number;
        tax: number;
    } => {
        const totalGross = Math.round(quantity * unitPriceGross);
        const gross = Math.max(0, totalGross - discountAmount);
        const net = Math.round(gross / (1 + taxRate));
        const tax = gross - net;
        return { gross, net, tax };
    },

    calculateMultiLineTotal: (lines: Array<{ quantity: number; unit_price_net?: number; unit_price_gross?: number }>, useGross = false, taxRate: number = 0.19): {
        net: number;
        tax: number;
        gross: number;
    } => {
        if (useGross) {
            const gross = lines.reduce((acc, line) =>
                acc + Math.round(line.quantity * (line.unit_price_gross || 0)), 0
            );
            const net = Math.round(gross / (1 + taxRate));
            const tax = gross - net;
            return { net, tax, gross };
        } else {
            const net = lines.reduce((acc, line) =>
                acc + PricingUtils.calculateLineNet(line.quantity, line.unit_price_net || 0), 0
            );
            const tax = Math.ceil(net * taxRate);
            const gross = net + tax;
            return { net, tax, gross };
        }
    },

    formatAmount: (amount: number): string => {
        return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(amount));
    },

    formatCurrency: (amount: number): string => {
        return canonicalFormatCurrency(amount);
    },

    calculateUoMPrice: (basePrice: number, baseRatio: number, targetRatio: number): number => {
        if (!baseRatio || baseRatio === 0) return basePrice;
        const ratio = targetRatio / baseRatio;
        return Math.round(basePrice * ratio);
    },
};
