import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadToken, saveToken, setAuthFailHandler } from './api';
import { INK, s } from './ui';
import type { Me } from './ui';
import Login from './Login';
import Home from './Home';

export default function App() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    setAuthFailHandler(() => setMe(null));
    void (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const u = await api<{ id: number; role: string }>('/auth/me');
          const name = (await AsyncStorage.getItem('name')) ?? '';
          if (u.role === 'driver') setMe({ id: u.id, name });
        } catch {
          await saveToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  async function logout() {
    await saveToken(null);
    setMe(null);
  }

  if (!ready) {
    return (
      <View style={[s.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={INK} />
      </View>
    );
  }
  return me ? <Home me={me} onLogout={() => void logout()} /> : <Login onDone={setMe} />;
}
