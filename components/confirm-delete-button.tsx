'use client';

import { Button } from '@/components/ui/button';
import type { ComponentProps, ReactNode } from 'react';

export function ConfirmDeleteButton({
  action,
  confirmText,
  children = 'Borrar',
  size = 'sm',
  variant = 'ghost',
}: {
  action: () => Promise<void>;
  confirmText: string;
  children?: ReactNode;
  size?: ComponentProps<typeof Button>['size'];
  variant?: ComponentProps<typeof Button>['variant'];
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant={variant} size={size}>{children}</Button>
    </form>
  );
}
