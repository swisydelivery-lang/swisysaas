import AsyncStorage from '@react-native-async-storage/async-storage';

export const API: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.8:3100';

let token: string | null = null;
let onAuthFail: (() => void) | null = null;

export function setAuthFailHandler(fn: (() => void) | null) {
  onAuthFail = fn;
}

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem('token');
  return token;
}

export async function saveToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem('token', t);
  else await AsyncStorage.removeItem('token');
}

const map: Record<string, string> = {
  'Wrong phone or password': 'رقم الهاتف أو كلمة المرور غير صحيحة',
  'Office is disabled': 'حساب المكتب موقوف حاليا',
  'Subscription expired': 'المكتب متوقف مؤقتا حاول لاحقا',
  'Account disabled': 'حسابك موقوف',
  'Phone number already used': 'رقم الهاتف مسجل من قبل استخدم تسجيل الدخول',
  'Office not available': 'المكتب غير متاح حاليا اختر مكتبا آخر',
  'Wrong current password': 'كلمة المرور الحالية غير صحيحة', 'Too many attempts': 'محاولات كثيرة حاول بعد 15 دقيقة', 'Order cannot be cancelled': 'لا يمكن إلغاء الطلب بعد أن قبله مندوب', 'Both zones required': 'اختر منطقتي الاستلام والتسليم', 'Zone not found': 'المنطقة غير موجودة', 'Network request failed': 'تعذر الاتصال بالخادم تأكد من الإنترنت',
};

export function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : 'حدث خطأ';
  return map[m] ?? m;
}

export async function api<T = unknown>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login' && onAuthFail) onAuthFail();
    const m = data && data.message;
    throw new Error(Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed'));
  }
  return data as T;
}





