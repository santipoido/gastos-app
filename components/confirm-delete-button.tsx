'use client';

import { Button } from '@/components/ui/button';

export function ConfirmDeleteButton({
  action,
  confirmText,
}: {
  action: () => Promise<void>;
  confirmText: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm">Borrar</Button>
    </form>
  );
}
