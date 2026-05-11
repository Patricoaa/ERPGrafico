"use client";

import React from 'react';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { getEntityMetadata, formatEntityDisplay } from '@/lib/entity-registry';
import { Package } from 'lucide-react';

interface EntityBadgeProps {
  label: string;
  data: any;
  showIcon?: boolean;
  link?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EntityBadge — Premium component to display entity identifiers consistently.
 * Uses the central EntityRegistry for labels, icons, and formatting.
 */
export const EntityBadge: React.FC<EntityBadgeProps> = ({ 
  label, 
  data, 
  showIcon = true, 
  link = true,
  className,
  size = 'md'
}) => {
  const metadata = getEntityMetadata(label);
  const displayCode = formatEntityDisplay(label, data);
  
  if (!data) return null;

  const Icon = metadata?.icon || Package;
  const detailUrl = metadata?.detailUrlPattern?.replace('{id}', data.id?.toString() || data.toString());

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2 py-1 text-sm gap-1.5",
    lg: "px-3 py-1.5 text-base gap-2"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4"
  };

  const badgeContent = (
    <span className={cn(
      "inline-flex items-center font-medium rounded-md border transition-all duration-200",
      "bg-secondary/30 text-secondary-foreground border-secondary/50",
      "hover:bg-secondary/50 hover:border-secondary",
      sizeClasses[size],
      className
    )}>
      {showIcon && <Icon className={cn("shrink-0 opacity-70", iconSizes[size])} />}
      <span className="truncate max-w-[200px]">
        {displayCode}
      </span>
    </span>
  );

  if (link && detailUrl) {
    return (
      <Link href={detailUrl} className="inline-block outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md">
        {badgeContent}
      </Link>
    );
  }

  return badgeContent;
};

EntityBadge.displayName = "EntityBadge";
