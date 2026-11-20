import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { api } from './api';
import { errText } from './hooks';
import type { Driver, Order } from './types';

interface Zone {
  id: number;
  name: string;
  price: string;
}

interface Lookup {
  found: boolean;
  name: string | null;
  last: {
    order_text: string | null;
    pickup_zone: string | null;
    dropoff_zone: string | null;
    extra_pickups: { name: string }[];
    contact_phone: string | null;
  } | null;
}

const norm = (s: string) => s.trim().toLowerCase();
const feeText = (v: string | null | undefined) =>
  v && Number(v) > 0 ? String(Number(v)) : '';

export default function OrderModal(props: {
  order?: Order | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const order = props.order ?? null;
  const editing = order !== null;
  const [f, setF] = useState({
    phone: order?.customer_phone ?? '',
    name: order?.customer_name ?? '',
    text: order?.order_text ?? '',
    contact: order?.contact_phone ?? '',
    notes: order?.notes ?? '',
    fee: feeText(order?.delivery_fee),
    driverId: '',
  });
  const [pickup, setPickup] = useState(order?.pickup_zone ?? '');
  const [dropoff, setDropoff] = useState(order?.dropoff_zone ?? '');
  const [extras, setExtras] = useState<string[]>(
    (order?.extra_pickups ?? []).map((e) => e.name),
  );
  const [touched, setTouched] = useState(!editing);
  const [feeEdited, setFeeEdited] = useState(order?.fee_overridden ?? false);
  const [calc, setCalc] = useState<number | null>(
    order?.calculated_fee ? Number(order.calculated_fee) : null,
  );
  const [zones, setZones] = useState<Zone[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const byName = useMemo(
    () => new Map<string, Zone>(zones.map((z) => [norm(z.name), z] as [string, Zone])),
    [zones],
  );
  const zonesRef = useRef(byName);
  zonesRef.current = byName;

  useEffect(() => {
    api<Zone[]>('/zones').then(setZones).catch(() => undefined);
    api<Driver[]>('/drivers').then(setDrivers).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (editing) return;
    const p = f.phone.trim();
    if (!/^\d{8,15}$/.test(p)) {
      setHint('');
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<Lookup>('/orders/customer?phone=' + p);
        if (my !== seq.current) return;
        const known = (n: string | null | undefined) =>
          n && zonesRef.current.has(norm(n)) ? n : '';
        if (r.found) {
          setHint('عميل موجود: ' + (r.name ?? ''));
          setF((x) => ({
            ...x,
            name: r.name ?? '',
            text: r.last?.order_text ?? '',
            contact: r.last?.contact_phone ?? '',
          }));
          setPickup(known(r.last?.pickup_zone));
          setDropoff(known(r.last?.dropoff_zone));
          setExtras((r.last?.extra_pickups ?? []).map((e) => known(e.name)).filter(Boolean));
        } else {
          setHint('عميل جديد: اكتب بياناته');
          setF((x) => ({ ...x, name: '', text: '', contact: '' }));
          setPickup('');
          setDropoff('');
          setExtras([]);
        }
      } catch {
        setHint('');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [f.phone, editing]);

  useEffect(() => {
    const p = byName.get(norm(pickup));
    const d = byName.get(norm(dropoff));
    if (!p || !d) {
      setCalc(null);
      return;
    }
    const names = extras.map((x) => x.trim()).filter(Boolean);
    const ids: number[] = [];
    for (const n of names) {
      const z = byName.get(norm(n));
      if (!z) return;
      ids.push(z.id);
    }
    const t = setTimeout(async () => {
      try {
        const r = await api<{ fee: number }>('/zones/quote', {
          method: 'POST',
          body: { pickupZoneId: p.id, dropoffZoneId: d.id, extraZoneIds: ids },
        });
        setCalc(r.fee);
        if (touched && !feeEdited) setF((x) => ({ ...x, fee: String(r.fee) }));
      } catch {
        setCalc(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pickup, dropoff, extras, byName, touched, feeEdited]);

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  function changePickup(v: string) {
    setTouched(true);
    setPickup(v);
  }
  function changeDropoff(v: string) {
    setTouched(true);
    setDropoff(v);
  }
  function changeExtra(i: number, v: string) {
    setTouched(true);
    setExtras(extras.map((x, j) => (j === i ? v : x)));
  }
  function addExtra() {
    setTouched(true);
    setExtras([...extras, '']);
  }
  function removeExtra(i: number) {
    setTouched(true);
    setExtras(extras.filter((_, j) => j !== i));
  }
  function applyCalc() {
    if (calc === null) return;
    setFeeEdited(false);
    setF({ ...f, fee: String(calc) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{8,15}$/.test(f.phone.trim())) {
      setError('رقم العميل مطلوب (أرقام فقط)');
      return;
    }
    const names = extras.map((x) => x.trim()).filter(Boolean);
    let zoneBody: Record<string, unknown> = {};
    if ((!editing || touched) && (pickup.trim() || dropoff.trim() || names.length > 0)) {
      const pz = byName.get(norm(pickup));
      const dz = byName.get(norm(dropoff));
      if (!pz || !dz) {
        setError('اختر منطقتي الاستلام والتسليم من القائمة');
        return;
      }
      const ids: number[] = [];
      for (const n of names) {
        const z = byName.get(norm(n));
        if (!z) {
          setError('المكان الإضافي غير موجود في المناطق: ' + n);
          return;
        }
        ids.push(z.id);
      }
      zoneBody = { pickupZoneId: pz.id, dropoffZoneId: dz.id, extraPickupZoneIds: ids };
    }
    setBusy(true);
    try {
      const body = {
        customerPhone: f.phone.trim(),
        customerName: f.name.trim(),
        orderText: f.text.trim(),
        contactPhone: f.contact.trim(),
        notes: f.notes.trim(),
        deliveryFee: f.fee ? Number(f.fee) : undefined,
        ...zoneBody,
      };
      if (editing && order) {
        await api('/orders/' + order.id, { method: 'PATCH', body });
      } else {
        await api('/orders', {
          method: 'POST',
          body: { ...body, driverId: f.driverId ? Number(f.driverId) : undefined },
        });
      }
      props.onSaved();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const active = drivers.filter((d) => d.is_active);

  return (
    <div className="modal-back" onClick={props.onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{editing ? 'تعديل الطلب رقم ' + order?.id : 'إنشاء طلب جديد'}</h2>
        <datalist id="zones-list">
          {zones.map((z) => (
            <option key={z.id} value={z.name} />
          ))}
        </datalist>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="m1">رقم العميل <span className="req">*</span></label>
            <input id="m1" type="tel" autoFocus={!editing} value={f.phone} onChange={set('phone')} />
            {hint && <span className="hint">{hint}</span>}
          </div>
          <div className="field">
            <label htmlFor="m2">اسم العميل</label>
            <input id="m2" value={f.name} onChange={set('name')} />
          </div>
          <div className="field">
            <label htmlFor="m3">الطلب</label>
            <input id="m3" value={f.text} onChange={set('text')} />
          </div>
          <div className="field">
            <label htmlFor="m4">مكان الاستلام (اختر منطقة)</label>
            <input id="m4" list="zones-list" value={pickup} onChange={(e) => changePickup(e.target.value)} />
            {editing && !order?.pickup_zone && order?.pickup_address && (
              <span className="hint">العنوان الحالي: {order.pickup_address}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="m5">مكان التسليم (اختر منطقة)</label>
            <input id="m5" list="zones-list" value={dropoff} onChange={(e) => changeDropoff(e.target.value)} />
            {editing && !order?.dropoff_zone && order?.dropoff_address && (
              <span className="hint">العنوان الحالي: {order.dropoff_address}</span>
            )}
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>أماكن استلام إضافية</label>
            {extras.map((x, i) => (
              <div className="row" key={i}>
                <input
                  list="zones-list"
                  value={x}
                  onChange={(e) => changeExtra(i, e.target.value)}
                  placeholder="اسم المنطقة"
                  aria-label={'مكان استلام إضافي ' + (i + 1)}
                />
                <button type="button" className="btn small danger" onClick={() => removeExtra(i)}>حذف</button>
              </div>
            ))}
            <div>
              <button type="button" className="btn small" onClick={addExtra}>＋ مكان استلام إضافي</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="m6">قيمة التوصيل (تلقائية ويمكن تعديلها)</label>
            <input
              id="m6"
              type="number"
              min="0"
              step="0.01"
              value={f.fee}
              onChange={(e) => {
                setFeeEdited(true);
                setF({ ...f, fee: e.target.value });
              }}
            />
            {calc !== null && Number(f.fee || 0) !== calc && (
              <span className="hint">
                الرسم المحسوب: {calc}{' '}
                <button type="button" className="btn small" onClick={applyCalc}>استخدام المحسوب</button>
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="m7">هاتف المستلم (اختياري)</label>
            <input id="m7" type="tel" value={f.contact} onChange={set('contact')} />
          </div>
          <div className="field">
            <label htmlFor="m8">ملاحظات (اختياري)</label>
            <input id="m8" value={f.notes} onChange={set('notes')} />
          </div>
          {!editing && (
            <div className="field">
              <label htmlFor="m9">المندوب (اختياري)</label>
              <select id="m9" value={f.driverId} onChange={set('driverId')}>
                <option value="">بدون تعيين (يقبله أي مندوب)</option>
                {active.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="hint">الخانات من الاسم إلى قيمة التوصيل إجبارية قبل تسليم الطلب.</p>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button className="btn primary big" type="submit" disabled={busy}>
            {busy ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديل' : 'إنشاء الطلب'}
          </button>
          <button className="btn big" type="button" onClick={props.onClose}>إلغاء</button>
        </div>
      </form>
    </div>
  );
}
