import { useState } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import { money } from '../format';
import type { DriverFinance } from '../types';

export default function Finance() {
  const fin = useLoad<DriverFinance[]>('/finance/drivers');
  const com = useLoad<{ commission_percent: string }>('/finance/commission');
  const [pct, setPct] = useState('');
  const [msg, setMsg] = useState('');
  const list = fin.data ?? [];
  const total = list.reduce((s, d) => s + Number(d.balance), 0);

  async function saveCommission() {
    setMsg('');
    const n = Number(pct);
    if (pct === '' || Number.isNaN(n) || n < 0 || n > 100) {
      setMsg('أدخل نسبة بين 0 و 100');
      return;
    }
    try {
      await api('/finance/commission', { method: 'PATCH', body: { percent: n } });
      setPct('');
      await com.reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  async function pay(d: DriverFinance) {
    const v = window.prompt('المبلغ الذي استلمته من المندوب ' + d.full_name);
    if (v === null) return;
    const n = Number(v);
    if (Number.isNaN(n) || n <= 0) {
      setMsg('أدخل مبلغا صحيحا');
      return;
    }
    const note = window.prompt('ملاحظة (اختياري)') ?? '';
    setMsg('');
    try {
      await api('/finance/payments', {
        method: 'POST',
        body: { driverId: d.id, amount: n, note: note || undefined },
      });
      await fin.reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  return (
    <>
      {(fin.error || com.error || msg) && <div className="error">{fin.error || com.error || msg}</div>}
      <div className="card">
        <h2>نسبة عمولة المكتب من كل طلب</h2>
        <p>
          النسبة الحالية: <b>{money(com.data?.commission_percent)}%</b> من رسوم التوصيل وتسري على الطلبات الجديدة فقط.
        </p>
        <div className="row">
          <input
            type="number" min="0" max="100" step="0.01" value={pct}
            onChange={(e) => setPct(e.target.value)} placeholder="نسبة جديدة %"
            aria-label="نسبة العمولة الجديدة"
          />
          <button className="btn primary" onClick={() => void saveCommission()}>حفظ النسبة</button>
        </div>
      </div>

      <div className="card table-wrap">
        <h2>عمولات المكتب على المناديب (إجمالي المتبقي: {money(total)} ج.م)</h2>
        <table>
          <thead>
            <tr>
              <th>المندوب</th><th>الهاتف</th><th>طلبات مسلمة</th>
              <th>عمولة المكتب المستحقة</th><th>المدفوع للمكتب</th><th>المتبقي</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>{d.full_name}</td>
                <td>{d.phone}</td>
                <td>{d.delivered_orders}</td>
                <td>{money(d.due)}</td>
                <td>{money(d.paid)}</td>
                <td><b>{money(d.balance)}</b></td>
                <td><button className="btn small" onClick={() => void pay(d)}>تسجيل دفعة مستلمة</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}






