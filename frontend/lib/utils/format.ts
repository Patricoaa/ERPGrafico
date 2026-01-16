export const formatRUT = (value: string) => {
    // Remove all non-alphanumeric characters
    let cleanRUT = value.replace(/[^0-9kK]/g, "");

    // Limit to 9 characters (8 digits + 1 verification digit)
    if (cleanRUT.length > 9) {
        cleanRUT = cleanRUT.slice(0, 9);
    }

    if (cleanRUT.length <= 1) return cleanRUT;

    const dv = cleanRUT.slice(-1);
    let rut = cleanRUT.slice(0, -1);

    // Format RUT with dots
    let formattedRUT = "";
    while (rut.length > 3) {
        formattedRUT = "." + rut.slice(-3) + formattedRUT;
        rut = rut.slice(0, rut.length - 3);
    }
    formattedRUT = rut + formattedRUT;

    return `${formattedRUT}-${dv}`.toUpperCase();
};

export const validateRUT = (rut: string) => {
    const clean = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
    if (clean.length < 2 || clean.length > 9) return false;

    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);

    if (!/^[0-9]+$/.test(num)) return false;

    let res = 0;
    let mul = 2;
    for (let i = num.length - 1; i >= 0; i--) {
        res += parseInt(num.charAt(i)) * mul;
        mul = mul === 7 ? 2 : mul + 1;
    }
    const expectedDV = 11 - (res % 11);
    const dvChar = expectedDV === 11 ? "0" : expectedDV === 10 ? "K" : expectedDV.toString();
    return dvChar === dv;
};
