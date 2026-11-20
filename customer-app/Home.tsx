import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, errText } from './api';
import { Btn, OrderCard, s } from './ui';
import type { Me, Order } from './ui';
import AccountTab from './Account';
import ZonePicker, { findZone } from './ZonePicker';
import type { Zone } from './ZonePicker';

type Tab = 'orders' | 'new' | 'account';

export default function Home({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [extras, setExtras] = useState<string[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [fee, setFee] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api<Order[]>('/orders'));
      setError('');
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    api<Zone[]>('/zones')
      .then(setZones)
      .catch(() => undefined);
  }, []);

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
    if (text.trim().length < 2) {
      Alert.alert('تنبيه', 'اكتب الطلب');
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
        orderText: text.trim(),
        pickupZoneId: pz.id,
        dropoffZoneId: dz.id,
        extraPickupZoneIds: ids,
      });
      setText('');
      setPickup('');
      setDropoff('');
      setExtras([]);
      setTab('orders');
      await load();
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
  }

  async function cancelOrder(id: number) {
    try {
      await api('/orders/' + id + '/cancel', 'POST');
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
    await load();
  }

  function confirmCancel(id: number) {
    Alert.alert('تأكيد', 'هل تريد إلغاء الطلب رقم ' + id + '؟', [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم، إلغاء', style: 'destructive', onPress: () => void cancelOrder(id) },
    ]);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orders', label: 'طلباتي' },
    { key: 'new', label: 'طلب جديد' },
    { key: 'account', label: 'حسابي' },
  ];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.logoSmall}><Text style={s.logoText}>S</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { marginBottom: 0 }]}>أهلاً {me.name}</Text>
          {me.office ? <Text style={s.muted}>{me.office}</Text> : null}
        </View>
        <Pressable onPress={onLogout}><Text style={s.link}>خروج</Text></Pressable>
      </View>
      {error ? <Text style={[s.error, { paddingHorizontal: 16 }]}>{error}</Text> : null}

      {tab === 'orders' && (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          data={orders}
          keyExtractor={(o) => String(o.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          ListEmptyComponent={
            <Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>لا توجد طلبات بعد</Text>
          }
          renderItem={({ item }) => (
            <OrderCard o={item} onCancel={() => confirmCancel(item.id)} />
          )}
        />
      )}

      {tab === 'new' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>الطلب</Text>
          <TextInput style={s.input} value={text} onChangeText={setText} />
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
          <Btn title="إرسال الطلب" onPress={() => void createOrder()} primary />
        </ScrollView>
      )}

      {tab === 'account' && <AccountTab />}

      <View style={s.tabs}>
        {tabs.map((t) => (
          <Pressable key={t.key} style={s.tab} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
