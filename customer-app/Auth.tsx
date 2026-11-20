import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, errText, saveToken } from './api';
import { Btn, s } from './ui';
import type { Me, Office } from './ui';

interface LoginRes {
  token: string;
  user: { id: number; fullName: string; role: string };
  office: { name: string | null } | null;
}

export default function Auth({ onDone }: { onDone: (m: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [officeId, setOfficeId] = useState<number | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'register' && offices.length === 0) {
      api<Office[]>('/public/offices')
        .then(setOffices)
        .catch((e) => setError(errText(e)));
    }
  }, [mode, offices.length]);

  async function doLogin(p: string, pw: string) {
    const r = await api<LoginRes>('/auth/login', 'POST', { phone: p, password: pw });
    if (r.user.role !== 'customer') throw new Error('هذا التطبيق للعملاء فقط');
    const office = r.office?.name ?? '';
    await saveToken(r.token);
    await AsyncStorage.setItem('name', r.user.fullName);
    await AsyncStorage.setItem('office', office);
    onDone({ id: r.user.id, name: r.user.fullName, office });
  }

  async function submit() {
    setError('');
    const p = phone.trim();
    if (mode === 'register') {
      if (name.trim().length < 2) return setError('اكتب اسمك');
      if (!/^\d{8,15}$/.test(p)) return setError('رقم الهاتف يجب أن يكون أرقاما فقط');
      if (password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل');
      if (officeId === null) return setError('اختر المكتب (مدينتك)');
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await api('/public/register', 'POST', {
          fullName: name.trim(), phone: p, password, officeId,
        });
      }
      await doLogin(p, password);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.logo}><Text style={s.logoText}>S</Text></View>
      <Text style={s.title}>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</Text>

      {mode === 'register' && (
        <>
          <Text style={s.label}>الاسم</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} />
        </>
      )}
      <Text style={s.label}>رقم الهاتف</Text>
      <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Text style={s.label}>كلمة المرور</Text>
      <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry />

      {mode === 'register' && (
        <>
          <Text style={s.label}>اختر المكتب (مدينتك)</Text>
          {offices.map((o) => (
            <Pressable
              key={o.id}
              style={[s.choice, officeId === o.id && s.choiceOn]}
              onPress={() => setOfficeId(o.id)}
            >
              <Text style={s.text}>{o.city} - {o.name}</Text>
            </Pressable>
          ))}
        </>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      <Btn
        title={busy ? 'لحظة...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
        onPress={() => void submit()}
        primary
        disabled={busy}
      />
      <Btn
        title={mode === 'login' ? 'ليس لديك حساب إنشاء حساب' : 'لديك حساب تسجيل الدخول'}
        onPress={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}
      />
    </ScrollView>
  );
}
