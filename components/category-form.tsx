'use client';

import { createCategory } from '@/actions/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRef, useState } from 'react';

export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState('expense');

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createCategory(formData);
        formRef.current?.reset();
        setType('expense');
      }}
      className="flex gap-2"
    >
      <Input name="name" placeholder="Nombre" required className="flex-1" />
      <input
        type="color"
        name="color"
        defaultValue="#6b7280"
        className="h-8 w-10 rounded-lg border border-input bg-transparent p-0.5"
        aria-label="Color"
      />
      <input type="hidden" name="type" value={type} />
      <Select
        value={type}
        onValueChange={(value) => setType(value ?? 'expense')}
        items={{ expense: 'Gasto', income: 'Ingreso' }}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="expense">Gasto</SelectItem>
          <SelectItem value="income">Ingreso</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Agregar</Button>
    </form>
  );
}
