import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// Eliminado el "use client" si realmente no era necesario (ej. solo pasaba props al Dialog que sí es cliente).
// Si el Dialog es un Server Component por error, entonces el "use client" sí iría.
// Definición de Props estrictas en lugar de `any`
export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string; // Permitido solo si se gestiona correctamente con cn() o tailwind-merge
}

/**
 * Componente compuesto para modales estándar en todo el ERP.
 * Se centraliza el uso de Dialog de shadcn/ui.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className
}: BaseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
