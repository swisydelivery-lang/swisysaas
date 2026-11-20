import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput } from 'react-native';
import { api, errText } from './api';
import { Btn, s } from './ui';

export default function AccountTab() {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (newP.length < 6) return setError('كلمة المرور الجديدة 6 أحرف على الأقل');
    if (newP !== again) return setError('كلمتا المرور الجديدتان غير متطابقتين');
    try {
      await api('/auth/change-password', 'POST', {
        oldPassword: oldP,
        newPassword: newP,
      });
      setOldP('');
      setNewP('');
      setAgain('');
      Alert.alert('تم', 'تم تغيير كلمة المرور');
    } catch (e) {
      setError(errText(e));
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>تغيير كلمة المرور</Text>
      <Text style={s.label}>كلمة المرور الحالية</Text>
      <TextInput style={s.input} value={oldP} onChangeText={setOldP} secureTextEntry />
      <Text style={s.label}>كلمة المرور الجديدة</Text>
      <TextInput style={s.input} value={newP} onChangeText={setNewP} secureTextEntry />
      <Text style={s.label}>تأكيد كلمة المرور الجديدة</Text>
      <TextInput style={s.input} value={again} onChangeText={setAgain} secureTextEntry />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Btn title="حفظ" onPress={() => void submit()} primary />
    </ScrollView>
  );
}
