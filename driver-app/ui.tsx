import { Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';

export interface Me { id: number; name: string }
export interface Extra { name: string }
export interface Order {
  id: number;
  driver_id: number | null;
  customer_phone: string | null;
  customer_name: string | null;
  order_text: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_zone: string | null;
  dropoff_zone: string | null;
  extra_pickups: Extra[];
  contact_phone: string | null;
  notes: string | null;
  delivery_fee: string;
  status: string;
}
export interface Fin { delivered_orders: number; due: string; paid: string; balance: string }

export const GREEN = '#b7f000';
export const INK = '#1a1a1a';

export const statusLabel: Record<string, string> = {
  pending: 'بانتظار مندوب',
  assigned: 'تم التعيين',
  picked_up: 'تم الاستلام',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

export const money = (v: string | number | null | undefined) => Number(v ?? 0).toFixed(2);

const blank = (v: string | null | undefined) => !v || v.trim() === '';

export function isIncomplete(o: Order): boolean {
  return (
    blank(o.customer_phone) ||
    blank(o.customer_name) ||
    blank(o.order_text) ||
    blank(o.pickup_address) ||
    blank(o.dropoff_address) ||
    !(Number(o.delivery_fee) > 0)
  );
}

export function Btn(props: { title: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[s.btn, props.primary && s.btnPrimary, props.disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.btnText, props.primary && { fontWeight: '700' }]}>{props.title}</Text>
    </Pressable>
  );
}

export function CallBtn({ phone, label }: { phone: string; label: string }) {
  return (
    <Btn title={label + ' ' + phone} onPress={() => void Linking.openURL('tel:' + phone)} primary />
  );
}

export function OrderCard(props: {
  o: Order;
  onAccept?: () => void;
  onStatus?: (st: string) => void;
  onComplete?: () => void;
}) {
  const { o } = props;
  const mine = o.status !== 'pending';
  const extras = Array.isArray(o.extra_pickups) ? o.extra_pickups.map((e) => e.name) : [];
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.bold}>طلب #{o.id}</Text>
        <Text style={s.bold}>
          {Number(o.delivery_fee) > 0 ? money(o.delivery_fee) + ' ج.م' : 'بدون قيمة'}
        </Text>
      </View>
      {mine && o.customer_name ? <Text style={s.text}>العميل: {o.customer_name}</Text> : null}
      {mine && o.customer_phone ? <CallBtn phone={o.customer_phone} label="اتصال بالعميل" /> : null}
      <Text style={s.text}>الطلب: {o.order_text || '—'}</Text>
      <Text style={s.text}>من: {o.pickup_address || '—'}</Text>
      {extras.length > 0 ? (
        <Text style={s.text}>أماكن استلام إضافية: {extras.join('، ')}</Text>
      ) : null}
      <Text style={s.text}>إلى: {o.dropoff_address || '—'}</Text>
      {mine && o.contact_phone ? <CallBtn phone={o.contact_phone} label="اتصال بالمستلم" /> : null}
      {o.notes ? <Text style={s.muted}>ملاحظات: {o.notes}</Text> : null}
      <Text style={s.muted}>الحالة: {statusLabel[o.status] ?? o.status}</Text>
      {props.onAccept ? <Btn title="قبول الطلب" onPress={props.onAccept} primary /> : null}
      {props.onComplete && isIncomplete(o) ? (
        <Btn title="استكمال بيانات الطلب" onPress={props.onComplete} />
      ) : null}
      {props.onStatus && o.status === 'assigned' ? (
        <Btn title="تم الاستلام" onPress={() => props.onStatus!('picked_up')} primary />
      ) : null}
      {props.onStatus && o.status === 'picked_up' ? (
        <Btn title="تم التسليم" onPress={() => props.onStatus!('delivered')} primary />
      ) : null}
    </View>
  );
}

const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f7f2', paddingTop: TOP },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 16 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  logoSmall: { width: 40, height: 40, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 24, fontWeight: '700', color: INK },
  title: { fontSize: 24, fontWeight: '700', color: INK, textAlign: 'right', marginBottom: 12 },
  label: { fontSize: 17, fontWeight: '600', color: INK, textAlign: 'right', marginBottom: 6, marginTop: 12 },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#d5d8cb', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 18, textAlign: 'right', color: INK },
  error: { color: '#b42318', fontSize: 16, textAlign: 'right', marginVertical: 8 },
  hint: { color: '#555', fontSize: 15, textAlign: 'right', marginTop: 4 },
  btn: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: '#d5d8cb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: GREEN, borderColor: GREEN },
  btnText: { fontSize: 18, color: INK },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8df', borderRadius: 16, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  bold: { fontSize: 18, fontWeight: '700', color: INK },
  text: { fontSize: 17, color: INK, textAlign: 'right' },
  muted: { fontSize: 15, color: '#555', textAlign: 'right' },
  link: { fontSize: 17, color: INK, textDecorationLine: 'underline' },
  suggest: { borderWidth: 1, borderColor: '#d5d8cb', borderRadius: 12, backgroundColor: '#fff', marginTop: 4 },
  suggestItem: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e8df', paddingBottom: 16 },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  tabText: { fontSize: 16, color: '#555' },
  tabActive: { color: INK, fontWeight: '700' },
});
