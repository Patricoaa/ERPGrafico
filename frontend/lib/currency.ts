export const formatCurrency = (value: number | string | undefined | null) => {
    if (value === undefined || value === null) return '$0';
    const num = Number(value);
    if (isNaN(num)) return '$0';
    return num.toLocaleString('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    });
}
