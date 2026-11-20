import { useLoad } from '../hooks';
import { useAuth } from '../auth';
import { isToday, money } from '../format';
import type { DriverFinance, Driver, Order, OfficeRow } from '../types';

function Stat({ label, value, green }: { label: string; value: string | number; green?: boolean }) {
  return (
    <div className={green ? 'card stat green' : 'card stat'}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function SuperHome() {
  const { data, error } = useLoad<OfficeRow[]>('/offices');
  const offices = data ?? [];
  const active = offices.filter((o) => o.is_active).length;
  const expiring = offices.filter((o) => o.is_active && o.days_left <= 7).length;
  const drivers = offices.reduce((s, o) => s + o.drivers_count, 0);
  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="stats">
        <Stat label="عدد المكاتب" value={offices.length} />
        <Stat label="المكاتب الفعالة" value={active} />
        <Stat label="اشتراكات تنتهي خلال 7 أيام" value={expiring} green />
        <Stat label="إجمالي المناديب" value={drivers} />
      </div>
    </>
  );
}

function AdminHome() {
  const orders = useLoad<Order[]>('/orders');
  const drivers = useLoad<Driver[]>('/drivers');
  const fin = useLoad<DriverFinance[]>('/finance/drivers');
  const list = orders.data ?? [];
  const today = list.filter((o) => isToday(o.created_at)).length;
  const inProgress = list.filter((o) => o.status === 'assigned' || o.status === 'picked_up').length;
  const pending = list.filter((o) => o.status === 'pending').length;
  const activeDrivers = (drivers.data ?? []).filter((d) => d.is_active).length;
  const balance = (fin.data ?? []).reduce((s, d) => s + Number(d.balance), 0);
  const error = orders.error || drivers.error || fin.error;
  return (
    <>
      {error && <div className="error">{error}</div>}
      <div className="stats">
        <Stat label="طلبات اليوم" value={today} />
        <Stat label="قيد التوصيل" value={inProgress} />
        <Stat label="بانتظار مندوب" value={pending} />
        <Stat label="المناديب الفعالون" value={activeDrivers} />
        <Stat label="عمولات متبقية على المناديب" value={money(balance) + ' ج.م'} green />
      </div>
    </>
  );
}

export default function Home() {
  const { session } = useAuth();
  return session?.user.role === 'super_admin' ? <SuperHome /> : <AdminHome />;
}

