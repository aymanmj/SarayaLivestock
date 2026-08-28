#!/usr/bin/env node

/**
 * ============================================================================
 * Saraya Livestock ERP - Master Enterprise License Generator (Interactive & CLI)
 * أداة توليد التراخيص الرقمية المشفرة لنظام سرايا لإدارة الماشية والألبان
 * ============================================================================
 * الاستخدام:
 * 1. الوضع التفاعلي الممتع (أسئلة وأجوبة):
 *    node scripts/generate-license.js
 * 
 * 2. وضع المعاملات المباشر (CLI Flags):
 *    node scripts/generate-license.js --company "مزرعة السرايا النموذجية" --plan "ENTERPRISE" --days 365 --animals 1000 --hwid "SARAYA-HWID-XXXX-XXXX"
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootDir = path.resolve(__dirname, '..');
const privateKeyPath = path.join(rootDir, 'license-keys', 'saraya-livestock-private.pem');
const publicKeyPath = path.join(
  rootDir,
  'apps',
  'api',
  'src',
  'modules',
  'license',
  'saraya-license-public.pem',
);

function ensureKeysExist() {
  if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    console.log('⚠️ مفاتيح التشفير غير موجودة، جاري توليد زوج مفاتيح جديد أولاً...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.mkdirSync(path.dirname(privateKeyPath), { recursive: true });
    fs.mkdirSync(path.dirname(publicKeyPath), { recursive: true });
    fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
    fs.writeFileSync(publicKeyPath, publicKey, 'utf8');
  }
}

function generateLicense(payload) {
  ensureKeysExist();
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  
  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64');

  const signer = crypto.createSign('SHA256');
  signer.update(payloadBase64);
  signer.end();

  const signature = signer.sign(privateKey, 'base64');
  return `SARAYA-LIC.${payloadBase64}.${signature}`;
}

// ================= الوضع التفاعلي (Interactive Mode) =================
function askQuestion(rl, query, defaultValue = '') {
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${query} [الافتراضي: ${defaultValue}]: ` : `${query}: `;
    rl.question(promptText, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n================================================================');
  console.log('  🏛️ شركة السرايا للتقنية - مولد تراخيص منظومة الإنتاج الحيواني');
  console.log('================================================================\n');

  const companyName = await askQuestion(rl, '1. اسم المزرعة أو العميل', 'مزرعة السرايا للإنتاج الحيواني');
  const plan = await askQuestion(rl, '2. نوع الباقة (ENTERPRISE / STANDARD / TRIAL / LIFETIME)', 'ENTERPRISE');
  const daysStr = await askQuestion(rl, '3. مدة الترخيص بالأيام (أدخل 0 للترخيص الدائم مدى الحياة)', '365');
  const days = parseInt(daysStr, 10) || 365;
  const isPerpetual = days === 0 || plan.toUpperCase() === 'LIFETIME';

  const maxAnimalsStr = await askQuestion(rl, '4. الحد الأقصى لرؤوس الماشية المسموح بها', '1000');
  const maxAnimals = parseInt(maxAnimalsStr, 10) || 1000;

  const hardwareId = await askQuestion(rl, '5. بصمة عتاد الجهاز (HWID) للربط بالجهاز (* لأي جهاز)', '*');

  rl.close();

  const now = new Date();
  const expires = new Date();
  expires.setDate(expires.getDate() + (isPerpetual ? 36500 : days));

  const payload = {
    licenseId: `LIC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    companyName,
    plan: plan.toUpperCase(),
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    hardwareId: hardwareId.trim(),
    maxAnimals,
    isPerpetual,
    allowedModules: ['milking', 'herd', 'breeding', 'fattening', 'nutrition', 'financial', 'accounting_gl'],
  };

  const licenseKey = generateLicense(payload);

  console.log('\n================================================================');
  console.log('✅ تم توليد كود الترخيص الرقمي الموقع بنجاح (RSA-4096 Signed)');
  console.log('================================================================\n');
  console.log(`- كود الترخيص (License Key):\n\n${licenseKey}\n`);
  console.log('----------------------------------------------------------------');
  console.log(`- العميل: ${payload.companyName}`);
  console.log(`- الباقة: ${payload.plan}`);
  console.log(`- الصلاحية: ${isPerpetual ? 'ترخيص دائم (LIFETIME)' : `${days} يوماً (ينتهي: ${expires.toLocaleDateString('en-US')})`}`);
  console.log(`- بصمة الجهاز: ${payload.hardwareId}`);
  console.log(`- سعة القطيع: ${payload.maxAnimals} رأس`);
  console.log('================================================================\n');
}

// CLI Args parsing
const args = process.argv.slice(2);
if (args.length === 0) {
  runInteractive();
} else {
  let company = 'مزرعة سرايا';
  let plan = 'ENTERPRISE';
  let days = 365;
  let animals = 1000;
  let hwid = '*';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) company = args[++i];
    if (args[i] === '--plan' && args[i + 1]) plan = args[++i];
    if (args[i] === '--days' && args[i + 1]) days = parseInt(args[++i], 10);
    if (args[i] === '--animals' && args[i + 1]) animals = parseInt(args[++i], 10);
    if (args[i] === '--hwid' && args[i + 1]) hwid = args[++i];
  }

  const now = new Date();
  const expires = new Date();
  expires.setDate(expires.getDate() + days);

  const payload = {
    licenseId: `LIC-${Date.now().toString(36).toUpperCase()}`,
    companyName: company,
    plan: plan.toUpperCase(),
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    hardwareId: hwid,
    maxAnimals: animals,
    isPerpetual: days === 0,
    allowedModules: ['milking', 'herd', 'breeding', 'fattening', 'nutrition', 'financial', 'accounting_gl'],
  };

  const lic = generateLicense(payload);
  console.log(lic);
}
