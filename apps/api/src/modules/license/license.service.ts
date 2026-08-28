import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { LicenseCryptoService } from './license-crypto.service';
import { LicenseStatusResponseDto, ActivateLicenseDto, LicenseStatus } from './dto/license.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private licenseFilePath: string;
  private lastVerifiedTimestamp: number = 0;

  constructor(
    private licenseCrypto: LicenseCryptoService,
  ) {
    const dataDirectory = process.env.SARAYA_DATA_DIR || os.homedir();
    this.licenseFilePath = path.join(dataDirectory, '.saraya_livestock_license.key');
  }

  async onModuleInit() {
    this.logger.log('🔑 جاري فحص والتحقق من ترخيص المنظومة والاشتراك...');
    await this.checkLicenseStatus();
  }

  /**
   * قراءة كود الترخيص المخزن
   */
  private getStoredLicenseKey(): string {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        return fs.readFileSync(this.licenseFilePath, 'utf8').trim();
      }
    } catch {}
    return process.env.SARAYA_LICENSE_KEY || '';
  }

  /**
   * حفظ كود الترخيص
   */
  private saveLicenseKey(key: string): void {
    try {
      fs.mkdirSync(path.dirname(this.licenseFilePath), { recursive: true });
      fs.writeFileSync(this.licenseFilePath, key.trim(), 'utf8');
    } catch (e: any) {
      this.logger.warn(`تعذر حفظ ملف الترخيص: ${e.message}`);
    }
  }

  /**
   * فحص حالة الترخيص الحالية ومطابقة البصمة والساعة
   */
  async checkLicenseStatus(): Promise<LicenseStatusResponseDto> {
    const hwid = this.licenseCrypto.getHardwareId();
    let licenseKey = this.getStoredLicenseKey();

    if (!licenseKey) {
      return {
        isValid: false,
        status: 'UNLICENSED',
        message: 'لم يتم تفعيل ترخيص على هذا الخادم',
        isReadOnly: true,
        hardwareId: hwid,
      };
    }

    const verification = this.licenseCrypto.verifyLicenseString(licenseKey, this.lastVerifiedTimestamp);

    // تحديث توقيت التحقق
    this.lastVerifiedTimestamp = Date.now();

    if (verification.isClockTampered) {
      return {
        isValid: false,
        status: 'TAMPERED_CLOCK',
        message: '⚠️ تم رصد تلاعب بتوقيت النظام أو تراجع في الساعة. تم إيقاف التعديلات مؤقتاً.',
        isReadOnly: true,
        hardwareId: hwid,
      };
    }

    if (!verification.isValid || !verification.payload) {
      return {
        isValid: false,
        status: 'UNLICENSED',
        message: verification.errorReason || 'مفتاح الترخيص غير صالح أو منتهي الصلاحية',
        isReadOnly: true,
        hardwareId: hwid,
      };
    }

    const payload = verification.payload;
    const now = Date.now();
    const expiry = new Date(payload.expiresAt).getTime();
    const daysRemaining = payload.isPerpetual ? 9999 : Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));

    let status: LicenseStatus = 'ACTIVE';
    let message = `الترخيص نشط ومفعل (${payload.companyName})`;

    if (daysRemaining <= 7 && !payload.isPerpetual) {
      status = 'WARNING_EXPIRING_SOON';
      message = `⚠️ تنبيه: ينتهي اشتراك الترخيص بعد ${daysRemaining} أيام (${new Date(payload.expiresAt).toLocaleDateString('ar-SA')})`;
    }

    return {
      isValid: true,
      status,
      message,
      isReadOnly: false,
      hardwareId: hwid,
      details: {
        licenseId: payload.licenseId,
        companyName: payload.companyName,
        plan: payload.plan,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        daysRemaining,
        maxAnimals: payload.maxAnimals,
        isPerpetual: payload.isPerpetual,
        allowedModules: payload.allowedModules,
      },
    };
  }

  /**
   * تفعيل ترخيص جديد بواسطة العميل أو الدعم الفني
   */
  async activateLicense(dto: ActivateLicenseDto): Promise<LicenseStatusResponseDto> {
    if (!dto.licenseKey) {
      throw new BadRequestException('يرجى إدخال كود مفتاح الترخيص');
    }

    const verification = this.licenseCrypto.verifyLicenseString(dto.licenseKey, 0);

    if (!verification.isValid || !verification.payload) {
      throw new BadRequestException(verification.errorReason || 'كود الترخيص المدخل غير صالح');
    }

    // حفظ الترخيص المعتمد
    this.saveLicenseKey(dto.licenseKey);
    this.logger.log(`✅ تم تفعيل ترخيص جديد بنجاح: ${verification.payload.companyName} (${verification.payload.plan})`);

    return this.checkLicenseStatus();
  }

  getHardwareId(): { hardwareId: string } {
    return { hardwareId: this.licenseCrypto.getHardwareId() };
  }
}
