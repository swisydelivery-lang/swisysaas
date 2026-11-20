import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { api, errText } from './api';
import { Btn, OrderCard, isIncomplete, s } from './ui';
import type { Fin, Me, Order } from './ui';
import { MoneyTab, NewOrderTab } from './Tabs';
import AccountTab from './Account';
import Complete from './Complete';
import { useOrderAlarm } from './useOrderAlarm';

type Tab = 'available' | 'mine' | 'new' | 'money' | 'account';

export default function Home({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('available');
  const [orders, setOrders] = useState<Order[]>([]);
  const [fin, setFin] = useState<Fin | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState<Order | null>(null);
  const alarm = useOrderAlarm(true);
  const [bannerHidden, setBannerHidden] = useState(false);

  useEffect(() => {
    if (!alarm.ringing) setBannerHidden(false);
  }, [alarm.ringing]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await api<Order[]>('/orders'));
      setFin(await api<Fin>('/finance/me'));
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

  const available = orders.filter((o) => o.status === 'pending');
  const mine = orders.filter((o) => o.driver_id === me.id);

  async function accept(id: number) {
    try {
      await api('/orders/' + id + '/accept', 'POST');
      alarm.stop();
      setTab('mine');
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
    await load();
  }

  async function setStatus(id: number, st: string) {
    try {
      await api('/orders/' + id + '/status', 'POST', { status: st });
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
    await load();
  }

  function changeStatus(o: Order, st: string) {
    if (st !== 'delivered') {
      void setStatus(o.id, st);
      return;
    }
    if (isIncomplete(o)) {
      Alert.alert('بيانات ناقصة', 'أكمل بيانات الطلب أولاً ثم سلّمه', [
        { text: 'استكمال الآن', onPress: () => setCompleting(o) },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('تأكيد', 'هل تم تسليم الطلب رقم ' + o.id + '؟', [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم', onPress: () => void setStatus(o.id, st) },
    ]);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'available', label: 'المتاحة' },
    { key: 'mine', label: 'طلباتي' },
    { key: 'new', label: 'طلب جديد' },
    { key: 'money', label: 'مستحقاتي' },
    { key: 'account', label: 'حسابي' },
  ];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.logoSmall}><Text style={s.logoText}>S</Text></View>
        <Text style={[s.title, { flex: 1, marginBottom: 0 }]}>أهلاً {me.name}</Text>
        <Pressable onPress={onLogout}><Text style={s.link}>خروج</Text></Pressable>
      </View>
      {error ? <Text style={[s.error, { paddingHorizontal: 16 }]}>{error}</Text> : null}

      {(tab === 'available' || tab === 'mine') && (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          data={tab === 'available' ? available : mine}
          keyExtractor={(o) => String(o.id)}
          refreshing={loading}
          onRefresh={() => void load()}
          ListEmptyComponent={
            <Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>
              {tab === 'available' ? 'لا توجد طلبات متاحة الآن' : 'لا توجد طلبات'}
            </Text>
          }
          renderItem={({ item }) => {
            const active = item.status === 'assigned' || item.status === 'picked_up';
            return tab === 'available' ? (
              <OrderCard o={item} onAccept={() => void accept(item.id)} />
            ) : (
              <OrderCard
                o={item}
                onStatus={active ? (st) => changeStatus(item, st) : undefined}
                onComplete={active ? () => setCompleting(item) : undefined}
              />
            );
          }}
        />
      )}

      {tab === 'new' && (
        <NewOrderTab onCreated={() => { setTab('mine'); void load(); }} />
      )}
      {tab === 'money' && <MoneyTab fin={fin} />}
      {tab === 'account' && <AccountTab />}

      {completing && (
        <Complete
          order={completing}
          onClose={() => setCompleting(null)}
          onSaved={() => { setCompleting(null); void load(); }}
        />
      )}

      <Modal
        visible={alarm.ringing && !bannerHidden}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
          <View style={[s.card, { padding: 24, gap: 12 }]}>
            <Text style={[s.title, { textAlign: 'center', fontSize: 32 }]}>طلب جديد!</Text>
            <Text style={[s.text, { textAlign: 'center' }]}>
              وصل طلب جديد متاح للقبول. افتح الطلبات المتاحة واقبله قبل غيرك.
            </Text>
            <Btn
              title="عرض الطلبات المتاحة"
              primary
              onPress={() => {
                setTab('available');
                setBannerHidden(true);
                void load();
              }}
            />
          </View>
        </View>
      </Modal>

      <View style={s.tabs}>
        {tabs.map((t) => (
          <Pressable key={t.key} style={s.tab} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabActive]}>
              {t.label}
              {t.key === 'available' && available.length > 0 ? ' (' + available.length + ')' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
