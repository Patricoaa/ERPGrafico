import { ServiceContractForm } from "@/components/forms/ServiceContractForm"

export default function NewServiceContractPage() {
    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Nuevo Contrato de Servicio</h1>
            <ServiceContractForm />
        </div>
    )
}
