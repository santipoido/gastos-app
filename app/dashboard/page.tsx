import { getDashboardData } from '@/actions/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

export default async function DashboardPage() {
  const data = await getDashboardData();
  const balance = data.currentMonthIncome - data.currentMonthExpense;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <Card>
        <CardHeader><CardTitle>Balance del mes</CardTitle></CardHeader>
        <CardContent>
          <p className={`text-3xl font-semibold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="text-income">{formatCurrency(data.currentMonthIncome)}</span> ingresos ·{' '}
            <span className="text-expense">{formatCurrency(data.currentMonthExpense)}</span> gastos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Proyección próximos meses</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.projection.map((p) => (
            <div key={p.yearMonth} className="flex justify-between text-sm">
              <span>{p.yearMonth}</span>
              <span>{formatCurrency(p.total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gasto por categoría (mes actual)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.categoryBreakdown.map((c) => (
            <div key={c.categoryId} className="flex justify-between text-sm">
              <span>{c.categoryName}</span>
              <span>{formatCurrency(c.total)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Próximos vencimientos</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {data.upcoming.map((u, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium">{u.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(u.date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              <span className="text-sm font-medium text-expense">{formatCurrency(u.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
