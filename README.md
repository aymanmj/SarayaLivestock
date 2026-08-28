# منظومة سرايا لإدارة مزارع الماشية والألبان والتسمين
### Saraya Livestock, Dairy & Fattening Farm Enterprise ERP

<div align="center">

[![CI Pipeline](https://img.shields.io/badge/CI-Passing-brightgreen.svg?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square)](#)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-red.svg?style=flat-square)](#)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg?style=flat-square)](#)
[![Electron](https://img.shields.io/badge/Electron-34.x-47848F.svg?style=flat-square)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=flat-square)](#)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748.svg?style=flat-square)](#)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-Proprietary-orange.svg?style=flat-square)](#)

**نظام متكامل ومؤسسي (Enterprise ERP) لإدارة وتشغيل مزارع الأبقار والإنتاج الحيواني، محطات الحلب الآلي، عنابر التسمين، التغذية والعلائق، السجلات البيطرية، والمحاسبة المالية المزدوجة ومراكز التكلفة.**

[نظرة عامة](#-نظرة-عامة-عن-المنظومة) •
[الميزات والوحدات](#-الوحدات-الوظيفية-الرئيسية) •
[المخططات الهندسية](#-المخططات-المعمارية-وسير-العمليات) •
[الهيكلية البرمجية](#-الهيكلية-البرمجية-monorepo-structure) •
[التشغيل والتثبيت](#-دليل-التثبيت-والتشغيل-quick-start) •
[النشر في بيئة الإنتاج](#-النشر-في-بيئة-الإنتاج-production-deployment) •
[الأمان والتراخيص](#-الأمان-وحماية-البيانات)

</div>

---

## 📖 نظرة عامة عن المنظومة

منظومة **سرايا للماشية (Saraya Livestock ERP)** هي منصة برمجية مؤسسية مصممة خصيصاً لإدارة المزارع الحيوانية الكبرى والمتوسطة، ومحطات إنتاج الألبان، ومشاريع التسمين التجاري. تم بناء المنظومة بهندسة معمارية حديثة متعددة المستأجرين والفروع (**Multi-Tenant & Multi-Farm Hierarchy**) تضمن عزل البيانات، الدقة المحاسبية الصارمة، حماية العمليات المالية والتشغيلية من التكرار (**Idempotency**)، والعمل الموثوق في المزارع عبر تطبيقات الويب وسطح المكتب دون انقطاع.

---

## 🏛 المخططات المعمارية وسير العمليات

### 1. خريطة الوحدات والتكامل الوظيفي
![خريطة الوحدات](docs/assets/diagrams/01-modules-overview.jpg)

### 2. الهيكلية التنظيمية وعزل الفروع (Organizational Hierarchy)
![الهيكلية التنظيمية](docs/assets/diagrams/02-org-hierarchy.jpg)

### 3. تدفق البيانات والمزامنة غير المتصلة (Offline-First Sync Engine)
![محرك المزامنة](docs/assets/diagrams/04-offline-sync-flow.jpg)

---

## ✨ الوحدات الوظيفية الرئيسية

### 🐄 1. إدارة القطيع ودورة الحياة (Herd & Livestock Management)
* الترقيم الإلكتروني (RFID / QR / Ear Tags) ومتابعة السلالات والأنواع والأصول الوراثية.
* تتبع الحالة الإنتاجية والتناسلية (حالب، جاف، عشار، عجل رضيع، تسمين، مستبعد).
* إدارة الحظائر، العنابر، البنكات، وحركات النقل الداخلي بين المواقع بدقة لحظية.
* سجلات الوزن الدوري ومعدلات النمو اليومي (**ADG - Average Daily Gain**).

### 🥛 2. محطة الحلب وإنتاج الألبان (Milking & Dairy Operations)
* تسجيل الورديات اليومية (صباحية، مسائية، ليلية) لكل حظيرة وبقرة على حدة.
* فحص جودة الحليب (نسبة الدهون، البروتين، الحموضة، وخلايا العد الجسدي SCC).
* **الحظر التلقائي الصارم لحليب الحيوانات المعالجة**: منع دخول حليب الأبقار الخاضعة لفترات سحب المضادات الحيوية (Withdrawal Periods) إلى خط الإنتاج تلقائياً.
* خزانات الحلب، التبريد، التسليم للمصانع، وإدارة الفاقد والهوالك.

### 🌾 3. التغذية وتركيب العلائق والمخزون (Nutrition & Ration Management)
* تصميم العلائق المتوازنة حسب المرحلة الإنتاجية والوزن والحالة الفسيولوجية.
* إدارة مخزون الأعلاف، السيلاج، الدريس، المركزات، والإضافات العلفية.
* الصرف الآلي للعلائق مع حساب تكلفة العليقة للرأس الواحد يومياً وربطها المباشر بحسابات التكاليف.

### 💉 4. الرعاية البيطرية والتحصينات (Veterinary Health & Treatments)
* برامج التحصينات الوقائية الدورية وجداول الأدوية مع تنبيهات استباقية.
* السجل الطبي الشامل لكل رأس (التشخيص، الأعراض، الطبيب المعالج، والبروتوكول الطبي).
* حجز الأدوية ومتابعة فترات التحريم والسحب للحليب واللحم لمنع أي خروقات غذائية.

### 🧬 5. التناسل والتلقيح والولادات (Breeding & Reproduction)
* رصد دورات الشياع، بروتوكولات التزامن الهرموني، والتلقيح الطبيعي والاصطناعي (AI).
* سجلات السائل المنوي، السلالات، ونسب الخصوبة لكل ملقح أو طلّوقة.
* تشخيص الحمل الدوري (جس/سونار)، متابعة فترات الجفاف، وتوليد سجلات المواليد تلقائياً مع معاملات الأمان الذرية (**Atomic Calving Transactions**).

### ⚖️ 6. محطة التسمين وحسابات النمو (Fattening & Beef Analytics)
* دورات التسمين المخصصة، المجموعات والأوزان الابتدائية والمستهدفة.
* حساب معامل التحويل الغذائي (**FCR - Feed Conversion Ratio**) ومعدل الزيادة الوزنية اليومية.
* تقدير أوزان الذبح والجاهزية التسويقية وهوامش الأرباح المتوقعة للدفعة.

### 📊 7. المحاسبة المالية المزدوجة ومراكز التكلفة (Double-Entry Farm Accounting)
* شجرة حسابات متوافقة مع المعايير المحاسبية الزراعية وإهلاك الأصول البيولوجية (**IAS 41 Agriculture**).
* قيود يومية مزدوجة آلية مع كل حركة بيع حليب، شراء أعلاف، نفوق، أو استبعاد.
* ربط المصروفات بمراكز التكلفة (حسب الحظيرة، القطاع، أو الدفعة الإنتاجية).
* تقارير ميزان المراجعة، الأرباح والخسائر، قائمة الدخل، وإقفال الفترات المالية المحكم.

### 🔒 8. الأمان وتراخيص RSA-4096 وسجل التدقيق (Enterprise Security & Audit)
* مصادقة JWT متقدمة مع تدوير الـ Refresh Tokens، كشف إعادة الاستخدام، والإلغاء الفوري للجلسات.
* نظام تراخيص رقمية مشفرة بمفاتيح **RSA-4096** غير قابلة للتزوير تعمل دون الحاجة لاتصال خارجي دائم.
* سجل تدقيق شامل غير قابل للتعديل (**Immutable Audit Log**) لجميع عمليات الإضافة والتعديل والحذف.
* مفاتيح العمليات المانعة للتكرار (**Idempotency Keys**) لضمان سلامة العمليات المالية والشبكية.

---

## 🛠 التقنيات المستخدمة (Tech Stack)

| الطبقة (Layer) | التقنيات المستخدمة |
| :--- | :--- |
| **خادم الـ API والخدمات** | NestJS 11, TypeScript 5.8, Node.js 22, Express, Fastify, Helmet, Rate Limiter |
| **قواعد البيانات والتخزين** | PostgreSQL 16, Prisma ORM 6, Redis 7 (Caching & Rate Limiting) |
| **واجهة الويب (Web App)** | React 18, Vite 6, TanStack Query (React Query), Tailwind CSS, Lucide Icons |
| **تطبيق سطح المكتب (Desktop)** | Electron 34, TypeScript, Windows NSIS Installer |
| **عقود الربط (API Contracts)** | OpenAPI 3.0 / Swagger, Automated TypeScript Client Generation |
| **الحاويات والنشر** | Docker, Docker Compose, Caddy 2 (Reverse Proxy & Automatic TLS) |
| **التشفير وإدارة الأسرار** | HashiCorp Vault Integration, RSA-4096 Licensing Engine, AES-256-GCM |

---

## 📂 الهيكلية البرمجية (Monorepo Structure)

```
SarayaLivestock/
├── apps/
│   ├── api/                 # خادم الواجهات البرمجية (NestJS + Prisma + Core Engine)
│   │   ├── prisma/          # مخطط قاعدة البيانات (schema.prisma) وملفات الترحيل (Migrations)
│   │   ├── src/             # وحدات النظام (الحلب، القطيع، التغذية، المحاسبة، الأمان، التراخيص)
│   │   └── scripts/         # أدوات فحص العقود وإدارة قواعد البيانات
│   ├── web/                 # تطبيق الويب التفاعلي (React + Vite + Tailwind)
│   │   ├── src/api/         # عميل الـ API المولد تلقائياً من OpenAPI
│   │   └── src/pages/       # شاشات النظام ولوحات التحكم والتقارير
│   └── desktop/             # تطبيق سطح المكتب لنظام ويندوز (Electron Main Process)
├── deploy/                  # ملفات إعداد الإنتاج (Caddyfile, Dockerfile, Nginx)
├── docs/                    # التوثيق الهندسي، سجلات الترحيل، والمخططات المعمارية
│   ├── assets/diagrams/     # المخططات الهندسية وسير العمليات
│   ├── API_CONTRACTS.md     # وثيقة عقود وتوافقية الـ API
│   ├── DATABASE_MIGRATIONS.md # إجراءات ترحيل وتأمين قواعد البيانات
│   ├── IDEMPOTENCY.md       # معمارية منع التكرار وحماية العمليات
│   ├── PRODUCTION_ROADMAP.md # خارطة طريق الإنتاج وبوابات الجودة
│   └── SECRET_ROTATION.md   # دليل تدوير الأسرار والمفاتيح الأمنية
├── license-keys/            # مجلد حفظ مفاتيح الترخيص المشفرة (مستبعد من Git)
├── openapi/                 # مواصفات الـ OpenAPI الرسمية للمنظومة (saraya.openapi.json)
├── scripts/                 # أدوات توليد مفاتيح الترخيص والتحقق من العقود
├── compose.production.yml   # ملف تشغيل الحاويات الإنتاجية (Docker Compose)
├── docker-compose.yml       # ملف تشغيل بيئة التطوير المحلية (PostgreSQL + Redis)
├── run-all.bat              # سكريبت تشغيل المنظومة الكاملة على ويندوز بنقرة واحدة
└── package.json             # سكريبتات إدارة ومراقبة المستودع المشترك
```

---

## 🚀 دليل التثبيت والتشغيل (Quick Start)

### المتطلبات الأساسية (Prerequisites)
* **Node.js**: الإصدار `>= 20.0.0` (يُفضل 22.x LTS)
* **npm**: الإصدار `>= 10.0.0`
* **PostgreSQL**: الإصدار `16.x`
* **Redis**: الإصدار `7.x` (اختياري لبيئة التطوير، إلزامي لبيئة الإنتاج)
* **Docker & Docker Compose** (اختياري للتشغيل بالحاويات)

### 1. استنساخ المستودع وتثبيت التبعيات
```bash
git clone https://github.com/YOUR_ORGANIZATION/SarayaLivestock.git
cd SarayaLivestock

# تثبيت الحزم لكافة مشاريع الـ Monorepo
npm install
cd apps/api && npm install
cd ../web && npm install
cd ../desktop && npm install
cd ../..
```

### 2. إعداد المتغيرات البيئية
قم بنسخ ملف الإعدادات النموذجي:
```bash
cp .env.example .env
```
قم بتعديل قيم الاتصال بقاعدة البيانات في `.env` مثل:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/saraya_livestock_db?schema=public"
JWT_SECRET="your-super-strong-jwt-secret-min-32-chars"
PORT=4000
NODE_ENV=development
```

### 3. إعداد وتجهيز قاعدة البيانات (Prisma Migrations)
```bash
# توليد عميل Prisma وتطبيق ترحيلات قاعدة البيانات
npm run db:generate
npm run db:migrate

# (اختياري) بذر بيانات تجريبية لبيئة التطوير فقط
npm run db:seed:demo
```

### 4. التحقق من العقود والأنواع البرمجية
```bash
# التحقق الشامل من عقود OpenAPI وتوافق أنواع TypeScript
npm run contracts:check
npm run typecheck:web
```

### 5. تشغيل بيئة التطوير
يمكنك تشغيل كل جزء على حدة:
```bash
# تشغيل الـ API في نافذة (Port 4000)
npm run dev:api

# تشغيل واجهة الويب في نافذة أخرى (Port 3050)
npm run dev:web

# تشغيل واجهة سطح المكتب (Electron)
npm run desktop:dev
```

> 💡 **لمستخدمي ويندوز**: يمكنك النقر المزدوج على `run-all.bat` لتشغيل خادم الـ API، خادم الويب، وواجهة سطح المكتب تلقائياً في ثوانٍ معدودة.

---

## 🐳 النشر في بيئة الإنتاج (Production Deployment)

### التشغيل بواسطة Docker Compose
تتضمن المنظومة إعدادات إنتاجية كاملة باستخدام Caddy لخوادم الإنتاج الآمنة:
```bash
# إعداد متغيرات الإنتاج
cp deploy/.env.production.example deploy/.env.production

# تشغيل مكدس الإنتاج الكامل (API + Web + DB + Redis + Caddy)
docker compose -f compose.production.yml up -d --build
```

### بناء حزم التوزيع لتطبيق ويندوز (Desktop Installer)
```bash
# بناء حزمة التثبيت المستقلة (NSIS .exe Installer)
npm run build:desktop
```
ستجد ملف التثبيت الناتج في مجلد: `apps/desktop/dist-electron/`.

---

## 🧪 الاختبارات والجودة (Testing & CI)

تتضمن المنظومة خط أنابيب CI/CD متكامل على GitHub Actions يفحص جودة الكود، الأمان، وتوافق العقود تلقائياً عند كل دفع أو طلب دمج:

```bash
# تشغيل اختبارات الوحدة والأمان للـ API
cd apps/api && npm test -- --runInBand

# فحص الثغرات الأمنية للتبعيات
npm audit --omit=dev --audit-level=high
```

---

## 🔐 الأمان وحماية البيانات (Security & Compliance)

* **الأسرار والمفاتيح**: لا يتم تضمين أي مفاتيح تشفير خاصة أو كلمات مرور داخل المستودع نهائياً.
* **إدارة التراخيص**: يتم توقيع التراخيص بمفتاح RSA-4096 في بيئة معزولة، ويحتوي النظام فقط على المفتاح العام للتحقق من الصلاحية.
* **سجل التدقيق**: تخضع جميع العمليات الإدارية والمالية لتدقيق صارم ومسجل زمنياً باسم المستخدم وعنوان الـ IP.
* **للإبلاغ عن أي ثغرات أمنية**: يرجى مراجعة ملف [SECURITY.md](SECURITY.md).

---

## 📄 الترخيص وحقوق الملكية (License)

جميع الحقوق محفوظة لـ **فريق سرايا للحلول التقنية (Saraya Team) © 2026**.
هذا البرنامج ملكية خاصة وخاضع لشروط ترخيص الاستخدام التجاري المغلق. يُحظر النسخ أو التوزيع أو التعديل دون إذن خطي مسبق. لمزيد من التفاصيل يرجى مراجعة ملف [LICENSE](LICENSE).
