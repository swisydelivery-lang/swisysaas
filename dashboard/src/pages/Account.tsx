import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { errText } from '../hooks';

export default function Account() {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [again, setAgain] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(false);
    if (newPassword.length < 6) {
      setMsg('كلمة المرور الجديدة 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== again) {
      setMsg('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { oldPassword, newPassword },
      });
      setOk(true);
      setOld('');
      setNew('');
      setAgain('');
    } catch (err) {
      setMsg(errText(err));
    }
  }

  return (
    <form className="card" style={{ maxWidth: 420 }} onSubmit={submit}>
      <h2>تغيير كلمة المرور</h2>
      <div className="field">
        <label htmlFor="a1">كلمة المرور الحالية</label>
        <input id="a1" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="a2">كلمة المرور الجديدة</label>
        <input id="a2" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="a3">تأكيد كلمة المرور الجديدة</label>
        <input id="a3" type="password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </div>
      {msg && <div className="error">{msg}</div>}
      {ok && <div className="chip green">تم تغيير كلمة المرور</div>}
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" type="submit">حفظ</button>
      </div>
    </form>
  );
}
