'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/mes', label: 'Mes' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/recurrentes', label: 'Recurrentes' },
  { href: '/tarjetas', label: 'Tarjetas' },
  { href: '/categorias', label: 'Categorías' },
];

export function Nav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t bg-background p-2 text-xs">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname.startsWith(l.href) ? 'font-semibold text-primary' : 'text-muted-foreground'}
        >
          {l.label}
        </Link>
      ))}
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">Salir</Button>
      </form>
    </nav>
  );
}
