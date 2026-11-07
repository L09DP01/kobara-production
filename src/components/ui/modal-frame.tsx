'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

// Preserve legacy modal layouts while sharing focus, dismissal and viewport handling.
export function ModalFrame({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactElement<{ className?: string; children?: React.ReactNode }>;
}) {
  const [returnFocus] = React.useState(() =>
    typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);

  return <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-modal-scrim className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-sm" />
      <DialogPrimitive.Content asChild data-modal-surface aria-describedby={undefined} onCloseAutoFocus={event => {
        event.preventDefault();
        if (returnFocus?.isConnected) returnFocus.focus();
      }}>
        {React.cloneElement(children, {
          className: cn(children.props.className,
            'fixed left-1/2 top-1/2 z-[110] !m-0 w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 !overflow-y-auto overscroll-contain'),
        }, <><DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>{children.props.children}</>)}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
