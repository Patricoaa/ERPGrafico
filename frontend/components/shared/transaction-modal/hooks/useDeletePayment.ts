import api from '@/lib/api'
import { toast } from 'sonner'

export async function deletePayment(payId: number): Promise<void> {
    await api.delete(`/treasury/payments/${payId}/`)
    toast.success('Pago eliminado correctamente')
}
