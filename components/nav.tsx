'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

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
  const [open, setOpen] = useState(false);

  if (pathname === '/login') return null;

  return (
    <nav className="sticky top-0 z-10 border-b bg-background">
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-semibold">Gastos</span>

        <div className="hidden items-center gap-4 text-sm md:flex">
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
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t p-3 text-sm md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-md px-2 py-2 ${
                pathname.startsWith(l.href) ? 'font-semibold text-primary' : 'text-muted-foreground'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              Salir
            </Button>
          </form>
        </div>
      )}
    </nav>
  );
}
