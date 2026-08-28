#!/usr/bin/env node

/**
 * ============================================================================
 * Saraya Livestock ERP - Master RSA-4096 License Keypair Generator
 * أداة توليد زوج مفاتيح التراخيص الرقمية المشفرة (RSA 4096-bit)
 * ============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
  console.log('⚠️ زوج مفاتيح الترخيص موجود بالفعل مسبقاً:');
  console.log(`- المفتاح الخاص: ${privateKeyPath}`);
  console.log(`- المفتاح العام: ${publicKeyPath}`);
  console.log('تم الاحتفاظ بالمفاتيح الحالية لمنع إبطال التراخيص الصادرة.');
  process.exit(0);
}

console.log('🔐 جاري توليد زوج مفاتيح التشفير الرقمي RSA-4096 لشركة السرايا للتقنية...');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.mkdirSync(path.dirname(privateKeyPath), { recursive: true });
fs.mkdirSync(path.dirname(publicKeyPath), { recursive: true });

fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8' });
fs.writeFileSync(publicKeyPath, publicKey, 'utf8');

const publicKeyDer = crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
const keyId = crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 16).toUpperCase();

console.log('✅ تم إنشاء زوج مفاتيح الترخيص بنجاح!');
console.log(`🔑 معرف المفتاح العام (Key ID): ${keyId}`);
console.log(`📁 المفتاح الخاص (Private Key): ${privateKeyPath}`);
console.log(`📁 المفتاح العام (Public Key): ${publicKeyPath}`);
console.log('⚠️ تنبيه أمني: المفتاح الخاص سري للغاية ويُحفظ في مقر الشركة فقط ولا يُرسل للعملاء.');
