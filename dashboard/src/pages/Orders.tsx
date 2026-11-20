import { useEffect, useState } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import { money, statusClass, statusLabel } from '../format';
import type { Driver, Order } from '../types';
import OrderModal from '../OrderModal';

export default function Orders() {
  const [status, setStatus] = useState('');
  const orders = useLoad<Order[]>('/orders' + (status ? '?status=' + status : ''));
  const drivers = useLoad<Driver[]>('/drivers');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<Order | null>(null);
  const reload = orders.reload;

  useEffect(() => {
    const h = () => void reload();
    window.addEventListener('orders-changed', h);
    return () => window.removeEventListener('orders-changed', h);
  }, [reload]);

  const activeDrivers = (drivers.data ?? []).filter((d) => d.is_active);
  const names = new Map<number, string>(
    (drivers.data ?? []).map((d) => [d.id, d.full_name] as [number, string]),
  );

  async function patch(id: number, body: object) {
    setMsg('');
    try {
      await api('/orders/' + id, { method: 'PATCH', body });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  function cancel(o: Order) {
    if (window.confirm('إلغاء الطلب رقم ' + o.id + '؟')) void patch(o.id, { cancel: true });
  }

  return (
    <>
      {(orders.error || msg) && <div className="error">{orders.error || msg}</div>}
      <div className="row">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="تصفية بالحالة">
          <option value="">كل الحالات</option>
          {Object.keys(statusLabel).map((s) => (
            <option key={s} value={s}>{statusLabel[s]}</option>
          ))}
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>العميل</th><th>الطلب</th><th>من</th><th>إلى</th>
              <th>الحالة</th><th>المندوب</th><th>الرسوم</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).map((o) => {
              const open = o.status !== 'delivered' && o.status !== 'cancelled';
              const extras = Array.isArray(o.extra_pickups) ? o.extra_pickups : [];
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>
                    {o.customer_name ?? '—'}
                    {o.customer_phone && (
                      <div>عميل: <a href={'tel:' + o.customer_phone}>{o.customer_phone}</a></div>
                    )}
                    {o.contact_phone && (
                      <div>مستلم: <a href={'tel:' + o.contact_phone}>{o.contact_phone}</a></div>
                    )}
                  </td>
                  <td>{o.order_text ?? '—'}</td>
                  <td>
                    {o.pickup_address || '—'}
                    {extras.length > 0 && (
                      <div className="hint">+ {extras.map((x) => x.name).join('، ')}</div>
                    )}
                  </td>
                  <td>{o.dropoff_address || '—'}</td>
                  <td><span className={statusClass(o.status)}>{statusLabel[o.status] ?? o.status}</span></td>
                  <td>{o.driver_id ? (names.get(o.driver_id) ?? '#' + o.driver_id) : '—'}</td>
                  <td>
                    {money(o.delivery_fee)}
                    {o.fee_overridden && <div><span className="chip amber">يدوي</span></div>}
                  </td>
                  <td>
                    {open && (
                      <div className="row">
                        <select
                          aria-label="تعيين مندوب"
                          value=""
                          onChange={(e) => e.target.value && void patch(o.id, { driverId: Number(e.target.value) })}
                        >
                          <option value="">تعيين مندوب</option>
                          {activeDrivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.full_name}</option>
                          ))}
                        </select>
                        <button className="btn small" onClick={() => setEditing(o)}>تعديل</button>
                        <button className="btn small danger" onClick={() => cancel(o)}>إلغاء</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <OrderModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </>
  );
}
