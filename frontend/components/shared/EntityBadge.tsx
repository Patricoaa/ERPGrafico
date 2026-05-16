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
  rounded?: boolean;
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
    sm: "h-6 px-3 text-[12px] gap-1.5",
    md: "h-8 px-4 text-[14px] gap-2",
    lg: "h-10 px-6 text-base gap-2.5"
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const badgeContent = (
    <span className={cn(
      "inline-flex items-center justify-center font-mono uppercase tracking-tight border transition-all duration-200 leading-none",
      "bg-secondary/30 text-secondary-foreground border-secondary/50",
      "hover:bg-secondary/50 hover:border-secondary",
      rounded ? "rounded-full" : "rounded-sm",
      sizeClasses[size],
      className
    )}>
      {showIcon && <Icon className={cn("shrink-0 opacity-60", iconSizes[size])} />}
      <span className="truncate font-black max-w-[200px] translate-y-[0.5px]">
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
