import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ErrorPage } from "./ErrorPage"

const meta = {
    title: "Shared/ErrorPage",
    component: ErrorPage,
    parameters: {
        layout: "centered",
    },
    tags: ["autodocs"],
    argTypes: {
        variant: {
            control: "select",
            options: ["default", "inline"],
            description: "Variante visual: default (página completa) o inline (dentro de layout)",
        },
        showReset: {
            control: "boolean",
            description: "Mostrar botón de reintentar",
        },
    },
    args: {
        onReset: () => console.log("reset clicked"),
    },
} satisfies Meta<typeof ErrorPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        title: "Error en Configuración",
        description: "No se pudo cargar el contenido de esta sección.",
        error: new Error("Failed to fetch settings: Network error"),
    },
}

export const WithCustomResetLabel: Story = {
    args: {
        title: "Error al Guardar",
        description: "Ocurrió un problema al procesar la solicitud.",
        error: new Error("Validation failed: invalid input"),
        resetLabel: "Volver a intentar",
    },
}

export const WithoutError: Story = {
    args: {
        title: "Sin Conexión",
        description: "Verifica tu conexión a internet e intenta de nuevo.",
        showReset: true,
    },
}

export const WithoutResetButton: Story = {
    args: {
        title: "Error Crítico",
        description: "Contacta al administrador del sistema.",
        error: new Error("FATAL: Database connection lost"),
        showReset: false,
    },
}

export const InlineVariant: Story = {
    args: {
        title: "Error en Widget",
        description: "Este componente no pudo cargarse.",
        error: new Error("Component load failed"),
        variant: "inline",
    },
    decorators: [
        (Story) => (
            <div className="border rounded-lg p-6 bg-muted/30 w-96">
                <Story />
            </div>
        ),
    ],
}

export const InlineWithoutError: Story = {
    args: {
        title: "Sin Datos",
        description: "No hay información disponible para mostrar.",
        variant: "inline",
        showReset: false,
    },
    decorators: [
        (Story) => (
            <div className="border rounded-lg p-6 bg-muted/30 w-96">
                <Story />
            </div>
        ),
    ],
}

export const LongErrorMessage: Story = {
    args: {
        title: "Error de Validación",
        description: "Los datos ingresados no son válidos.",
        error: new Error("ValidationError: field 'email' must be a valid email address, field 'rut' must match Chilean RUT format, field 'amount' must be greater than 0"),
    },
}