import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { LicensePayload } from './dto/license.dto';

@Injectable()
export class LicenseCryptoService {
  private readonly logger = new Logger(LicenseCryptoService.name);
  private cachedHwid: string | null = null;
  private publicKeyCache: string | null = null;

  constructor() {
    this.loadPublicKey();
  }

  private loadPublicKey(): void {
        let pubKeyPath = path.join(__dirname, 'saraya-license-public.pem');
    if (!fs.existsSync(pubKeyPath)) {
      pubKeyPath = path.join(process.cwd(), 'src/modules/license/saraya-license-public.pem');
    }
    if (!fs.existsSync(pubKeyPath)) {
      pubKeyPath = path.join(process.cwd(), 'apps/api/src/modules/license/saraya-license-public.pem');
    }
    try {
      if (fs.existsSync(pubKeyPath)) {
        this.publicKeyCache = fs.readFileSync(pubKeyPath, 'utf8');
      }
    } catch {}
  }

  /**
   * استخراج بصمة عتاد الجهاز الدائمة والثابتة بنسبة 100% (Hardware Fingerprint)
   */
  getHardwareId(): string {
    if (this.cachedHwid) {
      return this.cachedHwid;
    }

    const anchorPath = path.join(process.env.SARAYA_DATA_DIR || os.homedir(), '.saraya_livestock_hwid');
    try {
      if (fs.existsSync(anchorPath)) {
        const stored = fs.readFileSync(anchorPath, 'utf8').trim();
        if (stored.startsWith('SARAYA-HWID-') && stored.length >= 24) {
          this.cachedHwid = stored;
          return stored;
        }
      }
    } catch {}

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'UNKNOWN_CPU';
    const cpuCount = cpus.length;
    const hostname = os.hostname();
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '00:00:00:00:00:00';

    for (const name of Object.keys(networkInterfaces)) {
      const ifaceList = networkInterfaces[name];
      if (ifaceList) {
        for (const iface of ifaceList) {
          if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macAddress = iface.mac;
            break;
          }
        }
      }
    }

    const rawFingerprint = `CPU=${cpuModel}|COUNT=${cpuCount}|HOST=${hostname}|MAC=${macAddress}|PLAT=${os.platform()}`;
    const hash = crypto.createHash('sha256').update(rawFingerprint).digest('hex').toUpperCase();

    const hwid = `SARAYA-HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

    try {
      fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
      fs.writeFileSync(anchorPath, hwid, 'utf8');
    } catch {}

    this.cachedHwid = hwid;
    return hwid;
  }

  /**
   * فحص والتحقق من صحة مفتاح الترخيص (يدعم RSA-4096 والـ HMAC-SHA256) مع كشف التلاعب بالساعة
   */
  verifyLicenseString(
    licenseKey: string,
    lastVerifiedTimestamp: number = 0
  ): {
    isValid: boolean;
    payload?: LicensePayload;
    isClockTampered?: boolean;
    errorReason?: string;
  } {
    if (!licenseKey || !licenseKey.startsWith('SARAYA-LIC.')) {
      return { isValid: false, errorReason: 'صيغة كود الترخيص غير صحيحة' };
    }

    const parts = licenseKey.split('.');
    if (parts.length !== 3) {
      return { isValid: false, errorReason: 'كود الترخيص غير مكتمل أو تالف' };
    }

    const [, payloadBase64, signature] = parts;

    // 1. التحقق من التوقيع الرقمي RSA بواسطة المفتاح العام فقط
    let isSigValid = false;

    if (this.publicKeyCache) {
      try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(payloadBase64);
        verifier.end();
        isSigValid = verifier.verify(this.publicKeyCache, signature, 'base64');
      } catch {}
    }

    if (!isSigValid) {
      return { isValid: false, errorReason: 'التوقيع الرقمي لكود الترخيص غير صالح أو تم التعديل عليه' };
    }

    // 2. فك التشفير واستخراج البيانات
    let payload: LicensePayload;
    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      payload = JSON.parse(payloadJson);
    } catch {
      return { isValid: false, errorReason: 'تعذر قراءة بيانات الترخيص' };
    }

    // 3. التحقق من بصمة الجهاز (Hardware ID Match)
    const currentHwid = this.getHardwareId();
    if (payload.hardwareId !== '*' && payload.hardwareId !== currentHwid) {
      return {
        isValid: false,
        payload,
        errorReason: `هذا الترخيص مخصص لجهاز آخر (${payload.hardwareId}) ولا يعمل على هذا الجهاز (${currentHwid})`,
      };
    }

    // 4. فحص التلاعب بساعة النظام (Clock Rollback Detection)
    const now = Date.now();
    if (lastVerifiedTimestamp > 0 && now < lastVerifiedTimestamp - 60000) {
      return {
        isValid: false,
        payload,
        isClockTampered: true,
        errorReason: 'تم رصد تراجع في ساعة وتوقيت النظام (Clock Rollback Tampering)',
      };
    }

    // 5. فحص تاريخ انتهاء الصلاحية
    if (!payload.isPerpetual && payload.expiresAt) {
      const expiry = new Date(payload.expiresAt).getTime();
      if (now > expiry) {
        const expDate = new Date(payload.expiresAt);
        const dateStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
        return {
          isValid: false,
          payload,
          errorReason: `انتهت صلاحية هذا الترخيص بتاريخ ${dateStr}`,
        };
      }
    }

    return { isValid: true, payload };
  }
}


