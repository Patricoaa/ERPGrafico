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
  size = 'md',
  rounded = true,
}) => {
  const metadata = getEntityMetadata(label);
  const displayCode = formatEntityDisplay(label, data);
  
  if (!data) return null;

  const Icon = metadata?.icon || Package;
  const detailUrl = metadata?.detailUrlPattern?.replace('{id}', data.id?.toString() || data.toString());

  const sizeClasses = {
    sm: "h-5 px-2 text-[9px] gap-1",
    md: "h-6 px-2.5 text-[10px] gap-1.5",
    lg: "h-8 px-4 text-xs gap-2"
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5"
  };

  const badgeContent = (
    <span className={cn(
      "inline-flex items-center font-mono uppercase tracking-tight border transition-all duration-200",
      "bg-secondary/30 text-secondary-foreground border-secondary/50",
      "hover:bg-secondary/50 hover:border-secondary",
      rounded ? "rounded-full" : "rounded-sm",
      sizeClasses[size],
      className
    )}>
      {showIcon && <Icon className={cn("shrink-0 opacity-60", iconSizes[size])} />}
      <span className="truncate font-bold max-w-[200px]">
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
