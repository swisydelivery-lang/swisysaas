import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from '../api';
import { errText, useLoad } from '../hooks';
import { money } from '../format';
import { readRows } from '../readRows';

interface Zone {
  id: number;
  name: string;
  price: string;
}

interface PreviewRow {
  line: number;
  name: string;
  price: number;
  state: 'new' | 'update' | 'invalid';
  reason: string;
}

interface ImportResult {
  added: number;
  updated: number;
  errors: { row: number; reason: string }[];
}

const toNumber = (s: string) => Number(String(s ?? '').replace(',', '.'));

export default function Zones() {
  const { data, error, reload } = useLoad<Zone[]>('/zones');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const zones = data ?? [];
  const list = zones.filter((z) => z.name.toLowerCase().includes(q.trim().toLowerCase()));

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    const p = toNumber(price);
    if (!name.trim() || !Number.isFinite(p) || p < 0) {
      setMsg('اكتب اسم المنطقة وسعراً صحيحاً');
      return;
    }
    try {
      await api('/zones', { method: 'POST', body: { name: name.trim(), price: p } });
      setName('');
      setPrice('');
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  async function edit(z: Zone) {
    const n = window.prompt('اسم المنطقة', z.name);
    if (n === null) return;
    const p = window.prompt('السعر', String(Number(z.price)));
    if (p === null) return;
    const pn = toNumber(p);
    if (!n.trim() || !Number.isFinite(pn) || pn < 0) {
      setMsg('اكتب اسماً وسعراً صحيحين');
      return;
    }
    setMsg('');
    try {
      await api('/zones/' + z.id, { method: 'PATCH', body: { name: n.trim(), price: pn } });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  async function remove(z: Zone) {
    if (!window.confirm('حذف المنطقة ' + z.name + '؟ الطلبات القديمة لا تتأثر.')) return;
    setMsg('');
    try {
      await api('/zones/' + z.id, { method: 'DELETE' });
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setResult(null);
    setPreview(null);
    if (!file) return;
    try {
      const rows = await readRows(file);
      let start = 0;
      if (rows.length > 0 && !Number.isFinite(toNumber(rows[0][1] ?? ''))) start = 1;
      const existing = new Set(zones.map((z) => z.name.trim().toLowerCase()));
      const seen = new Set<string>();
      const out: PreviewRow[] = [];
      rows.slice(start).forEach((r, i) => {
        const nm = (r[0] ?? '').trim();
        const raw = r[1] ?? '';
        const pr = toNumber(raw);
        const line = i + 1 + start;
        let state: PreviewRow['state'] = 'new';
        let reason = '';
        if (!nm) {
          state = 'invalid';
          reason = 'الاسم فارغ';
        } else if (!Number.isFinite(pr) || pr < 0 || raw.trim() === '') {
          state = 'invalid';
          reason = 'السعر غير صحيح';
        } else if (seen.has(nm.toLowerCase())) {
          state = 'invalid';
          reason = 'اسم مكرر في الملف';
        } else {
          seen.add(nm.toLowerCase());
          state = existing.has(nm.toLowerCase()) ? 'update' : 'new';
        }
        out.push({ line, name: nm, price: pr, state, reason });
      });
      if (out.length === 0) setMsg('الملف لا يحتوي بيانات');
      else setMsg('');
      setPreview(out.length > 0 ? out : null);
    } catch {
      setMsg('تعذر قراءة الملف، استخدم xlsx أو csv');
    }
  }

  async function confirmImport() {
    if (!preview) return;
    const rows = preview
      .filter((r) => r.state !== 'invalid')
      .map((r) => ({ name: r.name, price: r.price }));
    setMsg('');
    try {
      const r = await api<ImportResult>('/zones/import', { method: 'POST', body: { rows } });
      setResult(r);
      setPreview(null);
      await reload();
    } catch (err) {
      setMsg(errText(err));
    }
  }

  const okCount = preview ? preview.filter((r) => r.state !== 'invalid').length : 0;
  const badCount = preview ? preview.length - okCount : 0;

  return (
    <>
      {(error || msg) && <div className="error">{error || msg}</div>}

      <form className="card" onSubmit={add}>
        <h2>إضافة منطقة</h2>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المنطقة" aria-label="اسم المنطقة" />
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر" aria-label="السعر" />
          <button className="btn primary" type="submit">إضافة</button>
        </div>
      </form>

      <div className="card">
        <h2>استيراد المناطق من Excel أو CSV</h2>
        <p className="hint">العمود الأول اسم المنطقة والثاني السعر، والصف الأول عناوين اختيارية. ملف Google Sheets: نزّله بصيغة xlsx أو csv.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void pickFile(e)} aria-label="ملف المناطق" />
        {preview && (
          <>
            <p><b>{okCount}</b> صف صالح، و<b>{badCount}</b> به خطأ (لن يُحفظ).</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>سطر</th><th>المنطقة</th><th>السعر</th><th>الحالة</th></tr></thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>{r.name || '—'}</td>
                      <td>{Number.isFinite(r.price) ? r.price : '—'}</td>
                      <td>
                        {r.state === 'new' && <span className="chip green">جديدة</span>}
                        {r.state === 'update' && <span className="chip amber">تحديث السعر</span>}
                        {r.state === 'invalid' && <span className="chip red">{r.reason}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" disabled={okCount === 0} onClick={() => void confirmImport()}>
                تأكيد الاستيراد ({okCount})
              </button>
              <button className="btn" onClick={() => setPreview(null)}>إلغاء</button>
            </div>
          </>
        )}
        {result && (
          <p>
            تم: أُضيفت <b>{result.added}</b> وحُدّثت <b>{result.updated}</b>
            {result.errors.length > 0 ? '، وتعذّر ' + result.errors.length : ''}.
          </p>
        )}
      </div>

      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المناطق" aria-label="بحث في المناطق" />
        <span className="chip">{list.length} منطقة</span>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>المنطقة</th><th>السعر</th><th>إجراءات</th></tr></thead>
          <tbody>
            {list.map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td>{money(z.price)}</td>
                <td>
                  <div className="row">
                    <button className="btn small" onClick={() => void edit(z)}>تعديل</button>
                    <button className="btn small danger" onClick={() => void remove(z)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={3}>لا توجد مناطق</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
