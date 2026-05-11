import { redirect } from 'next/navigation'

// T-101 (F9): core.Attachment fue eliminado del UniversalRegistry.
// No existe viewset en core/urls.py ni explorador de archivos implementado.
// Redirigir al dashboard como fallback hasta que se implemente el explorador.
export default async function DetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
    redirect('/')
}
