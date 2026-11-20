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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const map: Record<string, string> = {
  'Wrong phone or password': 'رقم الهاتف أو كلمة المرور غير صحيحة',
  'Office is disabled': 'حساب المكتب موقوف تواصل مع مكتبك',
  'Subscription expired': 'انتهى اشتراك المكتب تواصل مع مكتبك',
  'Account disabled': 'حسابك موقوف',
  'Order not available': 'الطلب لم يعد متاحا سبقك مندوب آخر',
  'Order not found or status not allowed': 'لا يمكن تغيير حالة هذا الطلب',
  'Wrong current password': 'كلمة المرور الحالية غير صحيحة', 'Too many attempts': 'محاولات كثيرة حاول بعد 15 دقيقة', 'Customer phone required': 'رقم العميل مطلوب', 'customerPhone must be 8-15 digits': 'رقم العميل يجب أن يكون من 8 إلى 15 رقما', 'Order not found or closed': 'الطلب غير موجود أو مغلق', 'Both zones required': 'اختر منطقتي الاستلام والتسليم', 'Zone not found': 'المنطقة غير موجودة', 'Network request failed': 'تعذر الاتصال بالخادم تأكد من الإنترنت',
};

const FIELDS: Record<string, string> = { customer_phone: 'رقم العميل', customer_name: 'اسم العميل', order_text: 'الطلب', pickup_address: 'مكان الاستلام', dropoff_address: 'مكان التسليم', delivery_fee: 'قيمة التوصيل' };
function fieldsMsg(message: string): string | null { const p = 'Order data incomplete: '; if (!message.startsWith(p)) return null; return 'بيانات الطلب ناقصة: ' + message.slice(p.length).split(',').map((k) => FIELDS[k] ?? k).join(' '); }
export function ar(message: string): string {
  return fieldsMsg(message) ?? map[message] ?? message;
}

export function errText(e: unknown): string {
  return ar(e instanceof Error ? e.message : 'حدث خطأ');
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
    throw new ApiError(Array.isArray(m) ? m.join(', ') : (m ?? 'Request failed'), res.status);
  }
  return data as T;
}







