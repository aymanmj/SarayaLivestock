## 📋 ملخص التغييرات (Summary of Changes)
<!-- وصف موجز لما يحققه هذا التغيير أو المشكلة التي يحلها -->

## 🧩 المكونات المتأثرة (Affected Components)
- [ ] API (`apps/api`)
- [ ] Web Client (`apps/web`)
- [ ] Desktop App (`apps/desktop`)
- [ ] Database Schema / Migrations (`prisma`)
- [ ] Documentation / Deployment (`docs` / `deploy`)

## 🔍 قائمة التحقق الهندسية (Quality Checklist)
- [ ] تم اجتياز فحص توافق عقود الـ OpenAPI (`npm run contracts:check`).
- [ ] تم اجتياز فحص أنواع TypeScript في الويب (`npm run typecheck:web`).
- [ ] تم تشغيل واجتياز اختبارات الوحدة (`cd apps/api && npm test`).
- [ ] لا توجد أي أسرار أو كلمات مرور أو مفاتيح خاصة مسجلة في الكود.
- [ ] تمت المحافظة على عزل المزارع والمؤسسات (Tenant & Farm Isolation).
- [ ] العمليات المالية والإنتاجية الجديدة محمية بـ Idempotency ومعاملات ذرية.
