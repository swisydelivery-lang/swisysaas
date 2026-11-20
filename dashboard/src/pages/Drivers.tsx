import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import type { Driver } from '../types';

const empty = { fullName: '', phone: '', password: '' };

export default function Drivers() {
  const { data, error, reload } = useLoad<Driver[]>('/drivers');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(empty);

  const set = (k: keyof typeof empty) => (e: ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/drivers', {
        method: 'POST',
        body: { fullName: f.fullName, phone: f.phone.trim(), password: f.password },
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
      await api('/drivers/' + id, { method: 'PATCH', body });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  function resetPassword(d: Driver) {
    const v = window.prompt('كلمة المرور الجديدة للمندوب ' + d.full_name + ' (6 أحرف على الأقل)');
    if (v === null) return;
    if (v.length < 6) {
      setMsg('كلمة المرور قصيرة');
      return;
    }
    void patch(d.id, { password: v });
  }

  return (
    <>
      {(error || msg) && <div className="error">{error || msg}</div>}
      <div className="row">
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إغلاق' : 'إضافة مندوب'}
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={create}>
          <h2>مندوب جديد</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="d1">الاسم</label><input id="d1" value={f.fullName} onChange={set('fullName')} /></div>
            <div className="field"><label htmlFor="d2">رقم الهاتف</label><input id="d2" type="tel" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label htmlFor="d3">كلمة المرور</label><input id="d3" type="password" value={f.password} onChange={set('password')} /></div>
          </div>
          <button className="btn primary" type="submit">حفظ</button>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>إجراءات</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.full_name}</td>
                <td>{d.phone}</td>
                <td>{d.is_active ? <span className="chip green">فعال</span> : <span className="chip red">موقوف</span>}</td>
                <td>
                  <div className="row">
                    <button className="btn small danger" onClick={() => void patch(d.id, { isActive: !d.is_active })}>
                      {d.is_active ? 'إيقاف' : 'تفعيل'}
                    </button>
                    <button className="btn small" onClick={() => resetPassword(d)}>تغيير كلمة المرور</button>
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
