import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { api } from '../api';
import { errText } from '../hooks';
import { money } from '../format';
import { readRows } from '../readRows';
import { downloadXlsx } from '../exportXlsx';

interface RowResult {
  row: number;
  ok: boolean;
  error: string | null;
  customerPhone: string;
  customerName: string;
  pickup: string;
  extras: string[];
  dropoff: string;
  fee: number | null;
  driverPhone: string;
}

interface ImportResponse {
  total: number;
  valid: number;
  invalid: number;
  created: number;
  rows: RowResult[];
}

const KEYS = [
  'customerPhone',
  'customerName',
  'orderText',
  'pickup',
  'extras',
  'dropoff',
  'fee',
  'contactPhone',
  'notes',
  'driverPhone',
];

const HEADERS = [
  'رقم العميل',
  'اسم العميل',
  'الطلب',
  'مكان الاستلام',
  'أماكن استلام إضافية',
  'مكان التسليم',
  'قيمة التوصيل',
  'هاتف المستلم',
  'ملاحظات',
  'هاتف المندوب',
];

const nk = (s: string) =>
  s
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, '')
    .toLowerCase();

const ALIASES: Record<string, string[]> = {
  customerPhone: ['رقم العميل', 'هاتف العميل', 'الهاتف', 'phone', 'customerphone'],
  customerName: ['اسم العميل', 'العميل', 'name', 'customername'],
  orderText: ['الطلب', 'تفاصيل الطلب', 'order'],
  pickup: ['مكان الاستلام', 'الاستلام', 'pickup'],
  extras: ['أماكن استلام إضافية', 'اماكن استلام اضافيه', 'اماكن اضافيه', 'إضافي', 'extras'],
  dropoff: ['مكان التسليم', 'التسليم', 'dropoff'],
  fee: ['قيمة التوصيل', 'الرسم', 'التوصيل', 'fee'],
  contactPhone: ['هاتف المستلم', 'المستلم', 'contact'],
  notes: ['ملاحظات', 'notes'],
  driverPhone: ['هاتف المندوب', 'المندوب', 'driver'],
};

const lookup = new Map<string, string>();
Object.keys(ALIASES).forEach((k) => ALIASES[k].forEach((a) => lookup.set(nk(a), k)));

const ERRORS: Record<string, string> = {
  'invalid customer phone': 'رقم العميل غير صحيح',
  'pickup required': 'مكان الاستلام مطلوب',
  'pickup zone not found': 'منطقة الاستلام غير موجودة',
  'dropoff required': 'مكان التسليم مطلوب',
  'dropoff zone not found': 'منطقة التسليم غير موجودة',
  'invalid fee': 'قيمة التوصيل غير صحيحة',
  'invalid contact phone': 'هاتف المستلم غير صحيح',
  'driver not found': 'المندوب غير موجود أو غير فعّال',
};

function reason(e: string | null): string {
  if (!e) return '';
  if (e.startsWith('extra zone not found: ')) {
    return 'منطقة إضافية غير موجودة: ' + e.slice('extra zone not found: '.length);
  }
  return ERRORS[e] ?? e;
}

export default function ImportOrders() {
  const [msg, setMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState<Record<string, string>[] | null>(null);
  const [startLine, setStartLine] = useState(1);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [done, setDone] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    downloadXlsx('نموذج-استيراد-الطلبات.xlsx', [
      {
        name: 'الطلبات',
        rows: [
          HEADERS,
          ['01000000000', 'اسم العميل', 'وصف الطلب', 'A', '', 'B', '', '', '', ''],
        ],
      },
    ]);
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMsg('');
    setPreview(null);
    setDone(null);
    setPayload(null);
    if (!file) return;
    try {
      const rows = await readRows(file);
      if (rows.length === 0) {
        setMsg('الملف لا يحتوي بيانات');
        return;
      }
      const map = new Map<number, string>();
      rows[0].forEach((c, i) => {
        const k = lookup.get(nk(c));
        if (k) map.set(i, k);
      });
      let start = 0;
      let colKey = (i: number) => KEYS[i];
      if (map.size >= 3) {
        start = 1;
        colKey = (i: number) => map.get(i) ?? '';
      }
      const objs = rows.slice(start).map((r) => {
        const o: Record<string, string> = {};
        r.forEach((c, i) => {
          const k = colKey(i);
          if (k) o[k] = c;
        });
        return o;
      });
      if (objs.length > 500) {
        setMsg('الملف أكبر من 500 صف، قسّمه إلى أجزاء');
        return;
      }
      setFileName(file.name);
      setStartLine(start);
      setPayload(objs);
      setBusy(true);
      const r = await api<ImportResponse>('/orders/import', {
        method: 'POST',
        body: { rows: objs, commit: false },
      });
      setPreview(r);
    } catch (err) {
      setMsg(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!payload) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await api<ImportResponse>('/orders/import', {
        method: 'POST',
        body: { rows: payload, commit: true },
      });
      setDone(r);
      setPreview(null);
      setPayload(null);
      window.dispatchEvent(new Event('orders-changed'));
    } catch (err) {
      setMsg(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function errorReport(src: ImportResponse) {
    const bad = src.rows.filter((r) => !r.ok);
    downloadXlsx('تقرير-أخطاء-الاستيراد.xlsx', [
      {
        name: 'الأخطاء',
        rows: [
          ['سطر الملف', 'رقم العميل', 'اسم العميل', 'الاستلام', 'أماكن إضافية', 'التسليم', 'سبب الخطأ'],
          ...bad.map((r) => [
            r.row + startLine + 1,
            r.customerPhone,
            r.customerName,
            r.pickup,
            r.extras.join('، '),
            r.dropoff,
            reason(r.error),
          ]),
        ],
      },
    ]);
  }

  const shown = preview ?? done;

  return (
    <>
      {msg && <div className="error">{msg}</div>}
      <div className="card">
        <h2>استيراد طلبات من Excel أو Google Sheets</h2>
        <p className="hint">
          الأعمدة: رقم العميل، اسم العميل، الطلب، مكان الاستلام، أماكن استلام إضافية (افصل بينها بفاصلة)،
          مكان التسليم، قيمة التوصيل (اختيارية، وإلا تُحسب تلقائياً)، هاتف المستلم، ملاحظات،
          هاتف المندوب (اختياري لتعيين الطلب مباشرة). الاستلام والتسليم والإضافي أسماء مناطق موجودة.
          ملف Google Sheets: نزّله بصيغة xlsx أو csv. الطلبات المستوردة تُنشأ جديدة.
        </p>
        <div className="row">
          <button className="btn" onClick={downloadTemplate}>تنزيل النموذج</button>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void pickFile(e)} aria-label="ملف الطلبات" disabled={busy} />
        </div>
        {fileName && preview && <p className="hint">الملف: {fileName}</p>}
      </div>

      {shown && (
        <div className="card table-wrap">
          {preview && (
            <h2>
              معاينة: {preview.valid} صف صالح، {preview.invalid} به خطأ (لن يُحفظ)
            </h2>
          )}
          {done && (
            <h2>
              تم إنشاء {done.created} طلب{done.invalid > 0 ? '، وتعذّر ' + done.invalid + ' صف' : ''}
            </h2>
          )}
          <div className="row" style={{ marginBottom: 12 }}>
            {preview && (
              <button className="btn primary" disabled={busy || preview.valid === 0} onClick={() => void confirm()}>
                تأكيد الحفظ ({preview.valid})
              </button>
            )}
            {shown.invalid > 0 && (
              <button className="btn" onClick={() => errorReport(shown)}>تنزيل تقرير الأخطاء</button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>سطر</th><th>رقم العميل</th><th>الاستلام</th><th>إضافي</th>
                <th>التسليم</th><th>الرسم</th><th>المندوب</th><th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {shown.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row + startLine + 1}</td>
                  <td>{r.customerPhone || '—'}</td>
                  <td>{r.pickup || '—'}</td>
                  <td>{r.extras.join('، ') || '—'}</td>
                  <td>{r.dropoff || '—'}</td>
                  <td>{r.fee === null ? '—' : money(r.fee)}</td>
                  <td>{r.driverPhone || '—'}</td>
                  <td>
                    {r.ok ? (
                      <span className="chip green">صالح</span>
                    ) : (
                      <span className="chip red">{reason(r.error)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
