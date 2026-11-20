import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import type { OfficeRow } from '../types';

const empty = {
  name: '',
  city: '',
  maxDrivers: '5',
  days: '30',
  adminName: '',
  adminPhone: '',
  adminPassword: '',
};

export default function Offices() {
  const { data, error, reload } = useLoad<OfficeRow[]>('/offices');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(empty);

  const set = (k: keyof typeof empty) => (e: ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/offices', {
        method: 'POST',
        body: {
          name: f.name,
          city: f.city,
          maxDrivers: Number(f.maxDrivers),
          days: Number(f.days),
          adminName: f.adminName,
          adminPhone: f.adminPhone.trim(),
          adminPassword: f.adminPassword,
        },
      });
      setF(empty);
      setShowForm(false);
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  async function patch(id: number, body: object) {
    setMsg('');
    try {
      await api('/offices/' + id, { method: 'PATCH', body });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  function changeMax(o: OfficeRow) {
    const v = window.prompt('الحد الأقصى الجديد لعدد المناديب', String(o.max_drivers));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      setMsg('أدخل رقماً صحيحاً');
      return;
    }
    void patch(o.id, { maxDrivers: n });
  }

  function changeNameCity(o: OfficeRow) {
    const n = window.prompt('اسم المكتب', o.name);
    if (n === null) return;
    const c = window.prompt('المدينة', o.city);
    if (c === null) return;
    if (n.trim().length < 2 || c.trim().length < 2) {
      setMsg('الاسم والمدينة حرفان على الأقل');
      return;
    }
    void patch(o.id, { name: n.trim(), city: c.trim() });
  }

  async function resetAdmin(o: OfficeRow) {
    const v = window.prompt('كلمة المرور الجديدة لأدمن مكتب ' + o.name + ' (6 أحرف على الأقل)');
    if (v === null) return;
    if (v.length < 6) {
      setMsg('كلمة المرور قصيرة');
      return;
    }
    setMsg('');
    try {
      await api('/offices/' + o.id + '/admin-password', {
        method: 'POST',
        body: { password: v },
      });
      window.alert('تم تغيير كلمة مرور الأدمن');
    } catch (err) {
      setMsg(errText(err));
    }
  }

  return (
    <>
      {(error || msg) && <div className="error">{error || msg}</div>}
      <div className="row">
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إغلاق' : 'إضافة مكتب جديد'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={create}>
          <h2>مكتب جديد وحساب أدمنه</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="o1">اسم المكتب</label><input id="o1" value={f.name} onChange={set('name')} /></div>
            <div className="field"><label htmlFor="o2">المدينة</label><input id="o2" value={f.city} onChange={set('city')} /></div>
            <div className="field"><label htmlFor="o3">الحد الأقصى للمناديب</label><input id="o3" type="number" min="0" value={f.maxDrivers} onChange={set('maxDrivers')} /></div>
            <div className="field"><label htmlFor="o4">مدة الاشتراك (أيام)</label><input id="o4" type="number" min="1" value={f.days} onChange={set('days')} /></div>
            <div className="field"><label htmlFor="o5">اسم الأدمن</label><input id="o5" value={f.adminName} onChange={set('adminName')} /></div>
            <div className="field"><label htmlFor="o6">هاتف الأدمن</label><input id="o6" type="tel" value={f.adminPhone} onChange={set('adminPhone')} /></div>
            <div className="field"><label htmlFor="o7">كلمة مرور الأدمن</label><input id="o7" type="password" value={f.adminPassword} onChange={set('adminPassword')} /></div>
          </div>
          <button className="btn primary" type="submit">حفظ</button>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>المكتب</th><th>المدينة</th><th>المناديب</th>
              <th>الاشتراك</th><th>الحالة</th><th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.name}</td>
                <td>{o.city}</td>
                <td>{o.drivers_count} / {o.max_drivers}</td>
                <td>
                  <span className={o.days_left <= 7 ? 'chip red' : 'chip green'}>
                    باقي {o.days_left} يوم
                  </span>
                </td>
                <td>{o.is_active ? <span className="chip green">فعّال</span> : <span className="chip red">موقوف</span>}</td>
                <td>
                  <div className="row">
                    <button className="btn small" onClick={() => changeNameCity(o)}>تعديل الاسم والمدينة</button>
                    <button className="btn small" onClick={() => void patch(o.id, { addDays: 30 })}>تجديد 30 يوم</button>
                    <button className="btn small" onClick={() => changeMax(o)}>تعديل الحد</button>
                    <button className="btn small" onClick={() => void resetAdmin(o)}>كلمة مرور الأدمن</button>
                    <button className="btn small danger" onClick={() => void patch(o.id, { isActive: !o.is_active })}>
                      {o.is_active ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
