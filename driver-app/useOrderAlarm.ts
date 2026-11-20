import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { api } from './api';

const RING_MS = 60000;
const POLL_MS = 4000;

export function useOrderAlarm(enabled: boolean) {
  const player = useAudioPlayer(require('./assets/alarm.wav'));
  const [ringing, setRinging] = useState(false);
  const known = useRef<Set<number> | null>(null);
  const alarm = useRef<{ ids: Set<number>; until: number } | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    player.loop = true;
  }, [player]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    async function tick() {
      try {
        const ids = await api<number[]>('/orders/pending');
        if (stopped) return;
        const cur = new Set<number>(ids);
        if (known.current === null) {
          known.current = cur;
        } else {
          const seen = known.current;
          const fresh = ids.filter((id) => !seen.has(id));
          fresh.forEach((id) => seen.add(id));
          if (fresh.length > 0) {
            const all = new Set<number>(alarm.current ? Array.from(alarm.current.ids) : []);
            fresh.forEach((id) => all.add(id));
            alarm.current = { ids: all, until: Date.now() + RING_MS };
          }
        }
        const a = alarm.current;
        if (a) {
          const stillPending = Array.from(a.ids).some((id) => cur.has(id));
          if (!stillPending || Date.now() >= a.until) alarm.current = null;
        }
        setRinging(alarm.current !== null);
      } catch {
        // ignore network errors, try again on the next tick
      }
    }
    void tick();
    const t = setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [enabled]);

  useEffect(() => {
    if (!ringing) return;
    const t = setInterval(() => {
      const a = alarm.current;
      if (a && Date.now() >= a.until) {
        alarm.current = null;
        setRinging(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [ringing]);

  useEffect(() => {
    if (ringing) {
      try {
        void player.seekTo(0);
        player.play();
      } catch {
        // sound unavailable
      }
      Vibration.vibrate([0, 700, 500], true);
    } else {
      try {
        player.pause();
      } catch {
        // already stopped
      }
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [ringing, player]);

  const stop = useCallback(() => {
    alarm.current = null;
    setRinging(false);
  }, []);

  return { ringing, stop };
}
