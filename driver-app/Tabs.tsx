import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { api, errText } from './api';
import { Btn, INK, money, s } from './ui';
import type { Fin } from './ui';
import ZonePicker, { findZone } from './ZonePicker';
import type { Zone } from './ZonePicker';

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

const empty = { phone: '', name: '', text: '', contact: '' };

export function NewOrderTab({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState(empty);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [fee, setFee] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const seq = useRef(0);
  const zonesRef = useRef<Zone[]>([]);
  zonesRef.current = zones;

  useEffect(() => {
    api<Zone[]>('/zones')
      .then(setZones)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
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
          n && findZone(zonesRef.current, n) ? n : '';
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
  }, [f.phone]);

  useEffect(() => {
    const p = findZone(zones, pickup);
    const d = findZone(zones, dropoff);
    if (!p || !d) {
      setFee(null);
      return;
    }
    const ids: number[] = [];
    for (const n of extras) {
      if (n.trim() === '') continue;
      const z = findZone(zones, n);
      if (!z) {
        setFee(null);
        return;
      }
      ids.push(z.id);
    }
    const t = setTimeout(async () => {
      try {
        const r = await api<{ fee: number }>('/zones/quote', 'POST', {
          pickupZoneId: p.id,
          dropoffZoneId: d.id,
          extraZoneIds: ids,
        });
        setFee(r.fee);
      } catch {
        setFee(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pickup, dropoff, extras, zones]);

  async function createOrder() {
    if (!/^\d{8,15}$/.test(f.phone.trim())) {
      Alert.alert('تنبيه', 'اكتب رقم العميل (أرقام فقط)');
      return;
    }
    const pz = findZone(zones, pickup);
    const dz = findZone(zones, dropoff);
    if (!pz || !dz) {
      Alert.alert('تنبيه', 'اختر منطقتي الاستلام والتسليم من القائمة');
      return;
    }
    const ids: number[] = [];
    for (const n of extras) {
      if (n.trim() === '') continue;
      const z = findZone(zones, n);
      if (!z) {
        Alert.alert('تنبيه', 'مكان إضافي غير موجود في المناطق: ' + n);
        return;
      }
      ids.push(z.id);
    }
    try {
      await api('/orders', 'POST', {
        customerPhone: f.phone.trim(),
        customerName: f.name.trim(),
        orderText: f.text.trim(),
        contactPhone: f.contact.trim(),
        pickupZoneId: pz.id,
        dropoffZoneId: dz.id,
        extraPickupZoneIds: ids,
      });
      setF(empty);
      setPickup('');
      setDropoff('');
      setExtras([]);
      setHint('');
      onCreated();
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.label}>رقم العميل</Text>
      <TextInput style={s.input} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <Text style={s.label}>اسم العميل</Text>
      <TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
      <Text style={s.label}>الطلب</Text>
      <TextInput style={s.input} value={f.text} onChangeText={(v) => setF({ ...f, text: v })} />
      <ZonePicker label="مكان الاستلام" value={pickup} onChange={setPickup} zones={zones} />
      {extras.map((x, i) => (
        <View key={i}>
          <ZonePicker
            label={'مكان استلام إضافي ' + (i + 1)}
            value={x}
            onChange={(v) => setExtras(extras.map((y, j) => (j === i ? v : y)))}
            zones={zones}
          />
          <Btn title="حذف هذا المكان" onPress={() => setExtras(extras.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Btn title="＋ مكان استلام إضافي" onPress={() => setExtras([...extras, ''])} />
      <ZonePicker label="مكان التسليم" value={dropoff} onChange={setDropoff} zones={zones} />
      <View style={[s.card, { marginTop: 16 }]}>
        <Text style={s.muted}>قيمة التوصيل (تُحسب تلقائياً)</Text>
        <Text style={s.bold}>{fee !== null ? fee.toFixed(2) + ' ج.م' : '—'}</Text>
      </View>
      <Text style={s.label}>هاتف المستلم (اختياري)</Text>
      <TextInput style={s.input} value={f.contact} onChangeText={(v) => setF({ ...f, contact: v })} keyboardType="phone-pad" />
      <Btn title="إنشاء الطلب" onPress={() => void createOrder()} primary />
    </ScrollView>
  );
}

export function MoneyTab({ fin }: { fin: Fin | null }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={[s.card, { backgroundColor: INK }]}>
        <Text style={{ color: '#ccc', fontSize: 16, textAlign: 'right' }}>المطلوب منك للمكتب</Text>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700', textAlign: 'right' }}>
          {money(fin?.balance)} ج.م
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.text}>طلبات مسلّمة: {fin?.delivered_orders ?? 0}</Text>
        <Text style={s.text}>إجمالي عمولة المكتب عليك: {money(fin?.due)} ج.م</Text>
        <Text style={s.text}>ما دفعته للمكتب: {money(fin?.paid)} ج.م</Text>
      </View>
    </ScrollView>
  );
}
