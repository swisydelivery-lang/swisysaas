import { useState } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';

interface Customer {
  id: number;
  full_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  orders_count: number;
}

export default function Customers() {
  const { data, error, reload } = useLoad<Customer[]>('/customers');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');

  const list = (data ?? []).filter(
    (c) => c.full_name.includes(q) || c.phone.includes(q),
  );

  async function toggle(c: Customer) {
    setMsg('');
    try {
      await api('/customers/' + c.id, {
        method: 'PATCH',
        body: { isActive: !c.is_active },
      });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  return (
    <>
      {(error || msg) && <div className="error">{error || msg}</div>}
      <div className="row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف"
          aria-label="بحث في العملاء"
        />
        <span className="chip">{list.length} عميل</span>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>الاسم</th><th>الهاتف</th><th>عدد الطلبات</th>
              <th>تاريخ التسجيل</th><th>الحالة</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.full_name}</td>
                <td>{c.phone}</td>
                <td>{c.orders_count}</td>
                <td>{c.created_at.slice(0, 10)}</td>
                <td>
                  {c.is_active ? (
                    <span className="chip green">فعال</span>
                  ) : (
                    <span className="chip red">موقوف</span>
                  )}
                </td>
                <td>
                  <button className="btn small danger" onClick={() => void toggle(c)}>
                    {c.is_active ? 'إيقاف' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
