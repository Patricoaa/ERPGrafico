export type DteDirection = 'sale' | 'purchase'

export type DteClass =
    | 'BOLETA'
    | 'BOLETA_EXENTA'
    | 'FACTURA'
    | 'FACTURA_EXENTA'
    | 'PURCHASE_INV'
    | 'NOTA_CREDITO'
    | 'NOTA_DEBITO'

export const AUTO_ISSUED_DTE_SALE: ReadonlySet<string> = new Set(['BOLETA', 'BOLETA_EXENTA'])

export const ATTACHMENT_REQUIRED_DTE: ReadonlySet<string> = new Set([
    'FACTURA',
    'PURCHASE_INV',
    'FACTURA_EXENTA',
    'NOTA_CREDITO',
    'NOTA_DEBITO',
])

export interface DteRegistrationData {
    dteClass: DteClass
    folio: string
    issueDate: string
    attachment: File | null
    isPending: boolean
    pickedFiscalMatchId?: number | null
    pickedFiscalMatchFolio?: string | null
}

export function emptyDteRegistration(dteClass: DteClass, today: string = ''): DteRegistrationData {
    return {
        dteClass,
        folio: '',
        issueDate: today,
        attachment: null,
        isPending: false,
        pickedFiscalMatchId: null,
        pickedFiscalMatchFolio: null,
    }
}

export function getDteLabel(cls: DteClass): string {
    switch (cls) {
        case 'BOLETA':
            return 'Boleta Electrónica'
        case 'BOLETA_EXENTA':
            return 'Boleta Exenta'
        case 'FACTURA':
            return 'Factura Electrónica'
        case 'FACTURA_EXENTA':
            return 'Factura Exenta'
        case 'PURCHASE_INV':
            return 'Factura de Compra'
        case 'NOTA_CREDITO':
            return 'Nota de Crédito'
        case 'NOTA_DEBITO':
            return 'Nota de Débito'
        default:
            return cls
    }
}

export function getDteSiiCode(cls: DteClass): number {
    switch (cls) {
        case 'FACTURA':
        case 'PURCHASE_INV':
            return 33
        case 'FACTURA_EXENTA':
            return 34
        case 'BOLETA':
            return 39
        case 'BOLETA_EXENTA':
            return 41
        case 'NOTA_DEBITO':
            return 56
        case 'NOTA_CREDITO':
            return 61
        default:
            return 0
    }
}

export function getDteDescription(cls: DteClass, direction: DteDirection): string {
    if (direction === 'sale') {
        switch (cls) {
            case 'BOLETA':
                return 'Consumidor final. Si se cobra con terminal integrado se emite automáticamente con folio SII o TUU.'
            case 'BOLETA_EXENTA':
                return 'Venta a consumidor final exenta de IVA.'
            case 'FACTURA':
                return 'Venta afecta a IVA con crédito fiscal.'
            case 'FACTURA_EXENTA':
                return 'Venta exenta de IVA.'
            case 'NOTA_CREDITO':
                return 'Corrige o anula una factura o boleta de venta.'
            case 'NOTA_DEBITO':
                return 'Aumenta el valor cobrado en una venta.'
            default:
                return ''
        }
    } else {
        switch (cls) {
            case 'BOLETA':
                return 'Boleta emitida por el proveedor (compra con boleta).'
            case 'BOLETA_EXENTA':
                return 'Boleta exenta emitida por el proveedor.'
            case 'FACTURA':
                return 'Factura de proveedor afecta a IVA (crédito fiscal).'
            case 'FACTURA_EXENTA':
                return 'Factura de proveedor exenta de IVA.'
            case 'PURCHASE_INV':
                return 'Factura de compra emitida al proveedor.'
            case 'NOTA_CREDITO':
                return 'Nota de crédito recibida del proveedor.'
            case 'NOTA_DEBITO':
                return 'Nota de débito recibida del proveedor.'
            default:
                return ''
        }
    }
}

export function isDteClassAutoIssued(cls: DteClass, direction: DteDirection): boolean {
    return direction === 'sale' && AUTO_ISSUED_DTE_SALE.has(cls)
}

export interface FiscalMatchContext {
    sii_code: number
    counterparty_rut?: string | null
    amount?: number | null
}
