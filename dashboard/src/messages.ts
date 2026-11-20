const map: Record<string, string> = {
  'Wrong phone or password': 'رقم الهاتف أو كلمة المرور غير صحيحة',
  'Office is disabled': 'حساب المكتب موقوف تواصل مع الإدارة',
  'Subscription expired': 'انتهى الاشتراك يرجى التجديد',
  'Drivers limit reached': 'وصلت للحد الأقصى لعدد المناديب',
  'Phone number already used': 'رقم الهاتف مستخدم من قبل',
  'Account disabled': 'الحساب موقوف',
  'Too many attempts': 'محاولات كثيرة حاول بعد 15 دقيقة', 'Invalid dates': 'التواريخ غير صحيحة (تأكد أن البداية قبل النهاية)', 'Range too long': 'الفترة أطول من سنة', 'Customer phone required': 'رقم العميل مطلوب', 'Invalid phone': 'رقم الهاتف غير صحيح', 'customerPhone must be 8-15 digits': 'رقم العميل يجب أن يكون من 8 إلى 15 رقما', 'Zone name already used': 'اسم المنطقة مستخدم من قبل', 'Zone not found': 'المنطقة غير موجودة', 'Both zones required': 'اختر منطقتي الاستلام والتسليم معاً', 'Name required': 'الاسم مطلوب', 'Not allowed': 'غير مسموح',
  'Failed to fetch': 'تعذر الاتصال بالخادم',
};

export function ar(message: string): string {
  return map[message] ?? message;
}




