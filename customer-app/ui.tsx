import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';

export interface Me { id: number; name: string; office: string }
export interface Office { id: number; name: string; city: string }
export interface Extra { name: string }
export interface Order {
  id: number;
  order_text: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_zone: string | null;
  dropoff_zone: string | null;
  extra_pickups: Extra[];
  notes: string | null;
  delivery_fee: string;
  status: string;
  created_at: string;
}

export const GREEN = '#b7f000';
export const INK = '#1a1a1a';

export const statusLabel: Record<string, string> = {
  pending: 'بانتظار مندوب',
  assigned: 'تم تعيين مندوب',
  picked_up: 'المندوب استلم الطلب',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

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

export function OrderCard({ o, onCancel }: { o: Order; onCancel?: () => void }) {
  const fee = Number(o.delivery_fee);
  const extras = Array.isArray(o.extra_pickups) ? o.extra_pickups.map((e) => e.name) : [];
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.bold}>طلب #{o.id}</Text>
        <Text style={s.bold}>{fee > 0 ? fee.toFixed(2) + ' ج.م' : 'بدون قيمة'}</Text>
      </View>
      <Text style={s.text}>الطلب: {o.order_text || '—'}</Text>
      <Text style={s.text}>من: {o.pickup_address || '—'}</Text>
      {extras.length > 0 ? (
        <Text style={s.text}>أماكن استلام إضافية: {extras.join('، ')}</Text>
      ) : null}
      <Text style={s.text}>إلى: {o.dropoff_address || '—'}</Text>
      {o.notes ? <Text style={s.muted}>ملاحظات: {o.notes}</Text> : null}
      <Text style={s.status}>{statusLabel[o.status] ?? o.status}</Text>
      <Text style={s.muted}>{o.created_at.slice(0, 10)}</Text>
      {onCancel && o.status === 'pending' ? <Btn title="إلغاء الطلب" onPress={onCancel} /> : null}
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
  btn: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: '#d5d8cb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: GREEN, borderColor: GREEN },
  btnText: { fontSize: 18, color: INK },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8df', borderRadius: 16, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  bold: { fontSize: 18, fontWeight: '700', color: INK },
  text: { fontSize: 17, color: INK, textAlign: 'right' },
  muted: { fontSize: 15, color: '#555', textAlign: 'right' },
  status: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'right' },
  link: { fontSize: 17, color: INK, textDecorationLine: 'underline' },
  choice: { borderWidth: 1, borderColor: '#d5d8cb', borderRadius: 12, backgroundColor: '#fff', padding: 16, marginTop: 8 },
  choiceOn: { backgroundColor: GREEN, borderColor: GREEN },
  suggest: { borderWidth: 1, borderColor: '#d5d8cb', borderRadius: 12, backgroundColor: '#fff', marginTop: 4 },
  suggestItem: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e8df', paddingBottom: 16 },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  tabText: { fontSize: 16, color: '#555' },
  tabActive: { color: INK, fontWeight: '700' },
});
