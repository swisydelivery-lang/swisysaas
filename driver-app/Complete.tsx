import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { api, errText } from './api';
import { Btn, s } from './ui';
import type { Order } from './ui';

const blank = (v: string | null | undefined) => !v || v.trim() === '';

export default function Complete(props: {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const o = props.order;
  const need = {
    phone: blank(o.customer_phone),
    name: blank(o.customer_name),
    text: blank(o.order_text),
    pickup: blank(o.pickup_address),
    dropoff: blank(o.dropoff_address),
    fee: !(Number(o.delivery_fee) > 0),
  };
  const [f, setF] = useState({ phone: '', name: '', text: '', pickup: '', dropoff: '' });

  async function save() {
    const body: Record<string, string> = {};
    if (need.phone && f.phone.trim()) body.customerPhone = f.phone.trim();
    if (need.name && f.name.trim()) body.customerName = f.name.trim();
    if (need.text && f.text.trim()) body.orderText = f.text.trim();
    if (need.pickup && f.pickup.trim()) body.pickupAddress = f.pickup.trim();
    if (need.dropoff && f.dropoff.trim()) body.dropoffAddress = f.dropoff.trim();
    if (Object.keys(body).length === 0) {
      Alert.alert('تنبيه', 'اكتب بيانات الخانات الفارغة أولاً');
      return;
    }
    try {
      await api('/orders/' + o.id + '/complete', 'PATCH', body);
      props.onSaved();
    } catch (e) {
      Alert.alert('تنبيه', errText(e));
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <View style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>استكمال بيانات الطلب #{o.id}</Text>
          {need.phone && (
            <>
              <Text style={s.label}>رقم العميل</Text>
              <TextInput style={s.input} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
            </>
          )}
          {need.name && (
            <>
              <Text style={s.label}>اسم العميل</Text>
              <TextInput style={s.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
            </>
          )}
          {need.text && (
            <>
              <Text style={s.label}>الطلب</Text>
              <TextInput style={s.input} value={f.text} onChangeText={(v) => setF({ ...f, text: v })} />
            </>
          )}
          {need.pickup && (
            <>
              <Text style={s.label}>مكان الاستلام</Text>
              <TextInput style={s.input} value={f.pickup} onChangeText={(v) => setF({ ...f, pickup: v })} />
            </>
          )}
          {need.dropoff && (
            <>
              <Text style={s.label}>مكان التسليم</Text>
              <TextInput style={s.input} value={f.dropoff} onChangeText={(v) => setF({ ...f, dropoff: v })} />
            </>
          )}
          {need.fee && (
            <Text style={s.error}>
              قيمة التوصيل ناقصة: يحددها المكتب، تواصل مع الأدمن قبل التسليم.
            </Text>
          )}
          <Btn title="حفظ" onPress={() => void save()} primary />
          <Btn title="إغلاق" onPress={props.onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
