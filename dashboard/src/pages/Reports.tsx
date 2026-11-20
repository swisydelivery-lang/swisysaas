import { useState } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import { money, statusLabel } from '../format';
import { downloadXlsx } from '../exportXlsx';

interface Row {
  id: number;
  full_name: string;
  delivered_orders: number;
  fees: string;
  commission: string;
}

interface Report {
  from: string;
  to: string;
  created: number;
  cancelled: number;
  delivered: number;
  fees: number;
  commission: number;
  received: number;
  drivers: Row[];
}

interface OrderRow {
  id: number;
  created: string;
  customer_phone: string | null;
  customer_name: string | null;
  order_text: string | null;
  pickup_address: string;
  extra_pickups: { name: string }[];
  dropoff_address: string;
  delivery_fee: string;
  calculated_fee: string | null;
  fee_overridden: boolean;
  status: string;
  driver: string | null;
  commission: string;
}

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function Stat({ label, value, green }: { label: string; value: string | number; green?: boolean }) {
  return (
    <div className={green ? 'card stat green' : 'card stat'}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function Reports() {
  const today = iso(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [msg, setMsg] = useState('');
  const { data, error } = useLoad<Report>('/reports/summary?from=' + from + '&to=' + to);

  function lastDays(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    setFrom(iso(d));
    setTo(today);
  }

  function thisMonth() {
    const d = new Date();
    setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
    setTo(today);
  }

  function exportSummary() {
    if (!data) return;
    downloadXlsx('تقرير-' + data.from + '-' + data.to + '.xlsx', [
      {
        name: 'الملخص',
        rows: [
          ['من', data.from],
          ['إلى', data.to],
          ['طلبات مسلّمة', data.delivered],
          ['إجمالي رسوم التوصيل المسلّمة', data.fees],
          ['عمولة المكتب المستحقة', data.commission],
          ['ما استلمه المكتب من المناديب', data.received],
          ['طلبات أُنشئت في الفترة', data.created],
          ['طلبات ملغاة', data.cancelled],
        ],
      },
      {
        name: 'المناديب',
        rows: [
          ['المندوب', 'طلبات مسلّمة', 'إجمالي الرسوم', 'عمولة المكتب'],
          ...data.drivers.map((d) => [d.full_name, d.delivered_orders, Number(d.fees), Number(d.commission)]),
        ],
      },
    ]);
  }

  async function exportOrders() {
    setMsg('');
    try {
      const rows = await api<OrderRow[]>('/reports/orders?from=' + from + '&to=' + to);
      downloadXlsx('طلبات-' + from + '-' + to + '.xlsx', [
        {
          name: 'الطلبات',
          rows: [
            ['رقم', 'التاريخ', 'رقم العميل', 'العميل', 'الطلب', 'الاستلام', 'أماكن إضافية', 'التسليم', 'الرسم النهائي', 'الرسم المحسوب', 'معدّل يدوياً', 'الحالة', 'المندوب', 'عمولة المكتب'],
            ...rows.map((o) => [
              o.id,
              o.created,
              o.customer_phone ?? '',
              o.customer_name ?? '',
              o.order_text ?? '',
              o.pickup_address,
              (o.extra_pickups ?? []).map((x) => x.name).join('، '),
              o.dropoff_address,
              Number(o.delivery_fee),
              o.calculated_fee === null ? '' : Number(o.calculated_fee),
              o.fee_overridden ? 'نعم' : 'لا',
              statusLabel[o.status] ?? o.status,
              o.driver ?? '',
              Number(o.commission),
            ]),
          ],
        },
      ]);
    } catch (err) {
      setMsg(errText(err));
    }
  }

  return (
    <>
      <div className="row no-print">
        <button className="btn small" onClick={() => { setFrom(today); setTo(today); }}>اليوم</button>
        <button className="btn small" onClick={() => lastDays(7)}>آخر 7 أيام</button>
        <button className="btn small" onClick={thisMonth}>هذا الشهر</button>
        <label htmlFor="rf">من</label>
        <input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label htmlFor="rt">إلى</label>
        <input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn small primary" onClick={() => window.print()}>طباعة</button>
        <button className="btn small primary" disabled={!data} onClick={exportSummary}>تصدير الملخص Excel</button>
        <button className="btn small primary" onClick={() => void exportOrders()}>تصدير الطلبات Excel</button>
      </div>

      {(error || msg) && <div className="error">{error || msg}</div>}

      {data && (
        <>
          <h2>تقرير من {data.from} إلى {data.to}</h2>
          <div className="stats">
            <Stat label="طلبات مسلّمة" value={data.delivered} />
            <Stat label="إجمالي رسوم التوصيل المسلّمة" value={money(data.fees) + ' ج.م'} />
            <Stat label="عمولة المكتب المستحقة" value={money(data.commission) + ' ج.م'} green />
            <Stat label="ما استلمه المكتب من المناديب" value={money(data.received) + ' ج.م'} />
            <Stat label="طلبات أُنشئت في الفترة" value={data.created} />
            <Stat label="طلبات ملغاة (من المُنشأة)" value={data.cancelled} />
          </div>

          <div className="card table-wrap">
            <h2>تفصيل المناديب</h2>
            <table>
              <thead>
                <tr>
                  <th>المندوب</th><th>طلبات مسلّمة</th>
                  <th>إجمالي الرسوم</th><th>عمولة المكتب</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => (
                  <tr key={d.id}>
                    <td>{d.full_name}</td>
                    <td>{d.delivered_orders}</td>
                    <td>{money(d.fees)}</td>
                    <td><b>{money(d.commission)}</b></td>
                  </tr>
                ))}
                {data.drivers.length === 0 && (
                  <tr><td colSpan={4}>لا توجد طلبات مسلّمة في هذه الفترة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
