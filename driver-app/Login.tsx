import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, errText, saveToken } from './api';
import { Btn, s } from './ui';
import type { Me } from './ui';

export default function Login({ onDone }: { onDone: (m: Me) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const r = await api<{ token: string; user: { id: number; fullName: string; role: string } }>(
        '/auth/login', 'POST', { phone: phone.trim(), password },
      );
      if (r.user.role !== 'driver') {
        setError('هذا التطبيق للمناديب فقط');
        return;
      }
      await saveToken(r.token);
      await AsyncStorage.setItem('name', r.user.fullName);
      onDone({ id: r.user.id, name: r.user.fullName });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[s.screen, { justifyContent: 'center', padding: 24 }]}>
      <View style={s.logo}><Text style={s.logoText}>S</Text></View>
      <Text style={s.title}>تطبيق المندوب</Text>
      <Text style={s.label}>رقم الهاتف</Text>
      <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={s.label}>كلمة المرور</Text>
      <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Btn title={busy ? 'جارٍ الدخول...' : 'دخول'} onPress={() => void submit()} primary disabled={busy} />
    </View>
  );
}
