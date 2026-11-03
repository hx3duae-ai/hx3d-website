import { EMIRATES, KINDS } from './validation';
export const A = {
  ar: {
    navAccount: 'حسابي', loginTitle: 'تسجيل الدخول', registerTitle: 'إنشاء حساب', name: 'الاسم الكامل', email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف (مع مفتاح الدولة)', password: 'كلمة المرور (10 أحرف على الأقل)', login: 'دخول', register: 'إنشاء الحساب',
    toRegister: 'ليس لديك حساب؟ أنشئ حساباً', toLogin: 'لديك حساب؟ سجّل الدخول', logout: 'تسجيل الخروج',
    hello: 'مرحباً', addresses: 'عناوين التوصيل', noAddresses: 'لا توجد عناوين محفوظة بعد.', addAddress: 'إضافة عنوان',
    save: 'حفظ العنوان', delete: 'حذف', addressSaved: 'تم حفظ العنوان.',
    fullName: 'الاسم على الطرد', emirate: 'الإمارة', area: 'المنطقة والحي', street: 'اسم الشارع', building: 'رقم المنزل أو الفيلا أو المبنى',
    apartment: 'رقم الشقة والطابق (اختياري)', kind: 'نوع العنوان', mapUrl: 'رابط الموقع على الخريطة (اختياري)', notes: 'ملاحظات التوصيل (اختياري)',
    kinds: { home: 'منزل', office: 'مكتب', shop: 'محل', other: 'غير ذلك' } as Record<string, string>,
    emirates: { 'Abu Dhabi': 'أبوظبي', Dubai: 'دبي', Sharjah: 'الشارقة', Ajman: 'عجمان', 'Umm Al Quwain': 'أم القيوين', 'Ras Al Khaimah': 'رأس الخيمة', Fujairah: 'الفجيرة' } as Record<string, string>,
    errs: {
      invalid: 'تحقق من الحقول المكتوبة، بعضها غير صحيح.', exists: 'يوجد حساب بهذا البريد. سجّل الدخول بدلاً من ذلك.',
      wrong: 'البريد أو كلمة المرور غير صحيحة.', rate: 'محاولات كثيرة فاشلة. انتظر 15 دقيقة ثم حاول مجدداً.',
      auth: 'سجّل الدخول أولاً.', notfound: 'هذا العنوان غير موجود في حسابك.', generic: 'حدث خطأ. حاول مرة أخرى.',
    },
  },
  en: {
    navAccount: 'Account', loginTitle: 'Sign in', registerTitle: 'Create account', name: 'Full name', email: 'Email',
    phone: 'Phone (with country code)', password: 'Password (at least 10 characters)', login: 'Sign in', register: 'Create account',
    toRegister: "Don't have an account? Create one", toLogin: 'Already have an account? Sign in', logout: 'Sign out',
    hello: 'Welcome', addresses: 'Delivery addresses', noAddresses: 'No saved addresses yet.', addAddress: 'Add address',
    save: 'Save address', delete: 'Delete', addressSaved: 'Address saved.',
    fullName: 'Name on delivery', emirate: 'Emirate', area: 'Area / neighbourhood', street: 'Street name', building: 'Building, villa or house number',
    apartment: 'Apartment and floor (optional)', kind: 'Address type', mapUrl: 'Map link (optional, https)', notes: 'Delivery notes (optional)',
    kinds: { home: 'Home', office: 'Office', shop: 'Shop', other: 'Other' } as Record<string, string>,
    emirates: { 'Abu Dhabi': 'Abu Dhabi', Dubai: 'Dubai', Sharjah: 'Sharjah', Ajman: 'Ajman', 'Umm Al Quwain': 'Umm Al Quwain', 'Ras Al Khaimah': 'Ras Al Khaimah', Fujairah: 'Fujairah' } as Record<string, string>,
    errs: {
      invalid: 'Some fields are missing or invalid. Please check them.', exists: 'An account with this email already exists. Sign in instead.',
      wrong: 'Email or password is incorrect.', rate: 'Too many failed attempts. Wait 15 minutes and try again.',
      auth: 'Please sign in first.', notfound: 'This address is not in your account.', generic: 'Something went wrong. Please try again.',
    },
  },
};
export { EMIRATES, KINDS };
