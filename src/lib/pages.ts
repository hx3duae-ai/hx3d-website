// Static site pages. Legal pages are DRAFTS: the owner must review them before publishing.
export const PAGES = {
  ar: {
    about: { title: 'من نحن', body: ['HX 3D علامة تجارية إماراتية للطباعة ثلاثية الأبعاد: هدايا، ديكور، استخدام شخصي، وخط عربي، مع طباعة مخصصة حسب تصميم العميل.', 'نصمم ونطبع كل قطعة بعناية، ونستخدم فيلمنت عالي الجودة وفحصاً قبل التسليم.'] },
    contact: { title: 'اتصل بنا', body: ['أرسل لنا استفسارك وسنرد عليك. ملاحظة: نموذج الإرسال ما يرسل الرسالة فعلياً بعد، لأن البريد والخدمة لم يُربطا بعد.'], cta: 'إرسال', labels: ['الاسم', 'البريد الإلكتروني', 'الرسالة'], sent: 'تم استلام الشكل محلياً، لكن الإرسال الفعلي غير مفعّل بعد.' },
    faq: { title: 'الأسئلة الشائعة', items: [
      ['كم تستغرق الطباعة؟', 'تختلف حسب حجم المنتج وعدد القطع، وتظهر مدة الإنتاج المتوقعة عند تأكيد الطلب.'],
      ['هل تقبلون ملفات خاصة بي؟', 'نعم. ارفع ملف STL أو 3MF أو OBJ أو GLB، وفاحص المجسمات يخبرك إن كان جاهزاً للمراجعة.'],
      ['ما الخامات المتوفرة؟', 'الألوان والخامات المتوفرة تُعرض فقط عندما تكون موجودة فعلياً في المخزون.'],
      ['هل أقدر أعرض التصميم قبل الشراء؟', 'نعم، من العارض ثلاثي الأبعاد في الموقع.'],
    ] },
    tracking: { title: 'تتبع الطلب', body: ['أدخل رقم الطلب والبريد الإلكتروني لعرض حالة طلبك.', 'ملاحظة: التتبع يعتمد على ربط Shopify، وحالياً لا توجد طلبات معروضة.'], labels: ['رقم الطلب', 'البريد الإلكتروني'], cta: 'عرض الحالة', notConnected: 'التتبع غير متاح حالياً لأن Shopify غير مربوط، ولن نعرض حالة طلب قبل ذلك.' },
    cart: { title: 'سلة المشتريات', empty: 'السلة فارغة.', note: 'إضافة المنتجات إلى السلة تفعّل بعد ربط Shopify.' },
    privacy: { title: 'سياسة الخصوصية', draft: 'مسودة للمراجعة: يجب أن تراجعها وتعدلها قبل النشر.', body: ['نجمع فقط البيانات اللازمة لتقديم الخدمة: الاسم، البريد، رقم الهاتف، وعنوان التوصيل عند الطلب.', 'لا نخزن بيانات البطاقات البنكية. الدفع يتم عبر مزود الدفع.', 'يمكنك طلب حذف بياناتك عبر صفحة الاتصال.'] },
    returns: { title: 'الاسترجاع والشحن', draft: 'مسودة للمراجعة: يجب أن تراجعها وتعدلها قبل النشر.', body: ['سياسة الاسترجاع والاستبدال والشحن تُحدد بعد مراجعتها من إدارة HX.', 'المنتجات المخصصة حسب المقاس أو التصميم قد تكون غير قابلة للاسترجاع، وسيُذكر ذلك صراحة قبل الشراء.'] },
  },
  en: {
    about: { title: 'About us', body: ['HX 3D is a UAE brand for 3D printing: gifts, home décor, personal use and Arabic calligraphy, plus custom printing from your design.', 'We design and print each piece carefully, with quality filament and an inspection before delivery.'] },
    contact: { title: 'Contact us', body: ['Send us your question and we will reply. Note: the form does not send messages yet, because email and the service are not connected.'], cta: 'Send', labels: ['Name', 'Email', 'Message'], sent: 'Your message was received locally, but actual sending is not enabled yet.' },
    faq: { title: 'Frequently asked questions', items: [
      ['How long does printing take?', 'It depends on size and quantity. The expected production time appears when you confirm an order.'],
      ['Can I send my own files?', 'Yes. Upload an STL, 3MF, OBJ or GLB file, and the model checker tells you whether it is ready for review.'],
      ['Which materials and colours are available?', 'Colours and materials are shown only when they are actually in stock.'],
      ['Can I preview the design before buying?', 'Yes, in the 3D viewer on the site.'],
    ] },
    tracking: { title: 'Track your order', body: ['Enter your order number and email to see your order status.', 'Note: tracking depends on the Shopify connection, and no orders are shown yet.'], labels: ['Order number', 'Email'], cta: 'Check status', notConnected: 'Tracking is not available yet because Shopify is not connected. We will not show an order status before that.' },
    cart: { title: 'Shopping cart', empty: 'Your cart is empty.', note: 'Adding products to the cart activates after Shopify is connected.' },
    privacy: { title: 'Privacy policy', draft: 'Draft for review: the owner must review and edit this before publishing.', body: ['We collect only what the service needs: name, email, phone, and delivery address when you order.', 'We do not store bank card data. Payment is handled by the payment provider.', 'You can ask us to delete your data through the contact page.'] },
    returns: { title: 'Returns and shipping', draft: 'Draft for review: the owner must review and edit this before publishing.', body: ['Return, exchange and shipping rules will be set after review by HX management.', 'Custom products made to a size or design may not be returnable, and this will be stated clearly before purchase.'] },
  },
};
