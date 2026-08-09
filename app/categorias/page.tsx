import { listCategories, deleteCategory } from '@/actions/categories';
import { CategoryDot } from '@/components/category-dot';
import { CategoryForm } from '@/components/category-form';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Categorías</h1>
      <CategoryForm />
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 px-6 py-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <CategoryDot color={c.color} />
                {c.name} <Badge variant="secondary">{c.type === 'income' ? 'Ingreso' : 'Gasto'}</Badge>
              </span>
              <ConfirmDeleteButton
                action={deleteCategory.bind(null, c.id)}
                confirmText={`¿Borrar la categoría "${c.name}"?`}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
