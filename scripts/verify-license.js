#!/usr/bin/env node

/**
 * ============================================================================
 * Saraya Livestock ERP - License Verification & Inspection CLI
 * أداة فحص وتدقيق التراخيص الرقمية
 * ============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicKeyPath = path.join(
  rootDir,
  'apps',
  'api',
  'src',
  'modules',
  'license',
  'saraya-license-public.pem',
);

const licenseString = process.argv[2];

if (!licenseString) {
  console.log('الاستخدام: node scripts/verify-license.js "SARAYA-LIC.eyJ..."');
  process.exit(1);
}

if (!fs.existsSync(publicKeyPath)) {
  console.error(`خطأ: المفتاح العام غير موجود في: ${publicKeyPath}`);
  process.exit(1);
}

const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

const parts = licenseString.split('.');
if (parts.length !== 3 || parts[0] !== 'SARAYA-LIC') {
  console.error('❌ خطأ: صيغة كود الترخيص غير صحيحة');
  process.exit(1);
}

const [, payloadBase64, signature] = parts;

const verifier = crypto.createVerify('SHA256');
verifier.update(payloadBase64);
verifier.end();

const isValid = verifier.verify(publicKey, signature, 'base64');

if (!isValid) {
  console.error('❌ التوقيع الرقمي للترخيص غير صالح أو تم التعديل عليه (Signature Invalid)!');
  process.exit(1);
}

try {
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
  console.log('\n================================================================');
  console.log('✅ الترخيص صالح وموقع رقمياً بنجاح بواسطة شركة السرايا للتقنية');
  console.log('================================================================');
  console.log(`- معرف الترخيص: ${payload.licenseId}`);
  console.log(`- اسم المزرعة: ${payload.companyName}`);
  console.log(`- الباقة: ${payload.plan}`);
  console.log(`- تاريخ الإصدار: ${payload.issuedAt}`);
  console.log(`- تاريخ الانتهاء: ${payload.isPerpetual ? 'دائم مدى الحياة' : payload.expiresAt}`);
  console.log(`- قفل العتاد (HWID): ${payload.hardwareId}`);
  console.log(`- سعة الماشية: ${payload.maxAnimals} رأس`);
  console.log(`- الوحدات المفعلة: ${payload.allowedModules.join(', ')}`);
  console.log('================================================================\n');
} catch (e) {
  console.error('❌ تعذر فك تشفير بيانات الترخيص:', e.message);
}
