"use client"

const CMYK_RING =
    "conic-gradient(from 0deg, oklch(0.72 0.18 227.08) 0deg 90deg, oklch(0.64 0.28 336.24) 90deg 180deg, oklch(0.88 0.19 94.87) 180deg 270deg, oklch(0.18 0.01 260.13) 270deg 360deg)"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html>
            <body style={{ margin: 0 }}>
                <div
                    style={{
                        display: "flex",
                        minHeight: "100vh",
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#f8f9fa",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            maxWidth: 400,
                            width: "100%",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                margin: "0 auto 16px",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#0f172a",
                                color: "#ffffff",
                                fontWeight: 900,
                                fontSize: 18,
                                letterSpacing: "0.05em",
                            }}
                        >
                            ERP
                        </div>

                        <div
                            style={{
                                width: 24,
                                height: 24,
                                margin: "0 auto 16px",
                                borderRadius: "50%",
                                background: CMYK_RING,
                                opacity: 0.5,
                            }}
                        />

                        <div style={{ margin: "24px 0" }}>
                            <p
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    color: "#6b7280",
                                    margin: "0 0 8px",
                                }}
                            >
                                Error crítico
                            </p>
                            <h1
                                style={{
                                    fontSize: 20,
                                    fontWeight: 900,
                                    letterSpacing: "-0.025em",
                                    color: "#111827",
                                    margin: 0,
                                }}
                            >
                                Algo salió mal
                            </h1>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    marginTop: 8,
                                    lineHeight: 1.5,
                                }}
                            >
                                Ha ocurrido un error inesperado. Por favor recargue la página o
                                intente nuevamente.
                            </p>
                            {error.digest && (
                                <p
                                    style={{
                                        fontSize: 12,
                                        fontFamily: "monospace",
                                        color: "#9ca3af",
                                        marginTop: 12,
                                        padding: "4px 8px",
                                        backgroundColor: "#f3f4f6",
                                        borderRadius: 4,
                                        display: "inline-block",
                                    }}
                                >
                                    Error ID: {error.digest}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => reset()}
                            style={{
                                padding: "10px 24px",
                                borderRadius: 6,
                                border: "1px solid #e5e7eb",
                                backgroundColor: "#ffffff",
                                color: "#111827",
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Intentar nuevamente
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
