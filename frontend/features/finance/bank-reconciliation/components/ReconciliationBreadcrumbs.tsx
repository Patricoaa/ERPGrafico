import React from "react"
import Link from "next/link"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface ReconciliationBreadcrumbsProps {
    statementId?: number | string
    statementDisplayId?: string
    isWorkbench?: boolean
}

export function ReconciliationBreadcrumbs({
    statementId,
    statementDisplayId,
    isWorkbench = false,
}: ReconciliationBreadcrumbsProps) {
    return (
        <Breadcrumb className="mb-4">
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/treasury">Tesorería</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                
                <BreadcrumbItem>
                    {statementDisplayId ? (
                        <BreadcrumbLink asChild>
                            <Link href="/treasury/reconciliation">Conciliación Bancaria</Link>
                        </BreadcrumbLink>
                    ) : (
                        <BreadcrumbPage>Conciliación Bancaria</BreadcrumbPage>
                    )}
                </BreadcrumbItem>

                {statementDisplayId && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {isWorkbench ? (
                                <BreadcrumbLink asChild>
                                    {/* Link back to summary view */}
                                    <Link href={`/treasury/reconciliation/${statementId}`}>
                                        {statementDisplayId}
                                    </Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{statementDisplayId}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </>
                )}

                {isWorkbench && (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Mesa de Conciliación</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
