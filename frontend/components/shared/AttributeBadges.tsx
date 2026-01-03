"use client"

import { Badge } from "@/components/ui/badge"

interface AttributeValue {
    id: number
    attribute_name: string
    value: string
}

interface AttributeBadgesProps {
    attributes: AttributeValue[]
}

export function AttributeBadges({ attributes }: AttributeBadgesProps) {
    if (!attributes || attributes.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {attributes.map((attr) => (
                <Badge
                    key={attr.id}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 font-normal bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                >
                    <span className="font-semibold mr-1">{attr.attribute_name}:</span> {attr.value}
                </Badge>
            ))}
        </div>
    );
}
