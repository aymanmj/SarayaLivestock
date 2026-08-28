import { BadGatewayException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SecretSource } from './dto/security-response.dto';

export interface SecretMetadata {
  keyName: string;
  version: number;
  lastRotated: Date;
  source: SecretSource;
  rotationAvailable: boolean;
  rotationUnavailableReason: string | null;
}

type CachedSecret = {
  value: string;
  version: number;
  lastRotated: Date;
  source: SecretSource;
};

@Injectable()
export class VaultService implements OnModuleInit {
  private readonly logger = new Logger(VaultService.name);
  private vaultAddr: string;
  private vaultToken: string;
  private isVaultOnline = false;
  private initialization?: Promise<void>;
  private readonly requestTimeoutMs = 5_000;
  
  private readonly managedSecretNames = ['ENCRYPTION_KEY', 'JWT_SECRET'] as const;
  private secretsCache = new Map<string, CachedSecret>();
  private auditLog: { timestamp: Date; action: string; key: string; status: string }[] = [];

  constructor() {
    this.vaultAddr = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    this.vaultToken = process.env.VAULT_TOKEN || '';
  }

  async onModuleInit() {
    await this.ensureInitialized();
  }

  private ensureInitialized() {
    this.initialization ??= this.initVault();
    return this.initialization;
  }

  /**
   * تهيئة الاتصال بـ HashiCorp Vault مع دعم وضع العمل المستقل للمزارع (Airgapped / Local Fallback)
   */
  async initVault() {
    this.logger.log('🔐 جاري تهيئة نظام إدارة وتدوير الأسرار (HashiCorp Vault & Security Engine)...');

    for (const keyName of this.managedSecretNames) {
      const value = process.env[keyName];
      if (value) {
        this.secretsCache.set(keyName, {
          value,
          version: 1,
          lastRotated: new Date(),
          source: 'ENVIRONMENT',
        });
      }
    }

    // Try connecting to HashiCorp Vault if configured
    if (this.vaultToken) {
      try {
        const response = await fetch(`${this.vaultAddr}/v1/sys/health`, {
          headers: { 'X-Vault-Token': this.vaultToken },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
        if (response.ok) {
          this.isVaultOnline = true;
          this.logger.log(`✅ تم الاتصال بنجاح بخادم HashiCorp Vault المركزي (${this.vaultAddr})`);
          await this.syncFromVault();
          return;
        }
      } catch (err: any) {
        this.logger.warn(`⚠️ تعذر الاتصال بـ HashiCorp Vault (${err.message}). استخدام أسرار البيئة مع تعطيل التدوير الفوري.`);
      }
    } else {
      this.logger.log('ℹ️ الأسرار محملة من متغيرات البيئة؛ التدوير الفوري معطل حتى يتصل الخادم بـ Vault.');
    }
  }

  /**
   * استرجاع سر محمي
   */
  async getSecret(key: string): Promise<string> {
    await this.ensureInitialized();
    const cached = this.secretsCache.get(key);
    const value = cached?.value || process.env[key];
    if (!value) {
      this.recordAudit('GET_SECRET', key, 'NOT_CONFIGURED');
      throw new Error(`Secret ${key} is not configured`);
    }
    this.recordAudit('GET_SECRET', key, 'SUCCESS');
    return value;
  }

  /**
   * تدوير مفتاح التشفير آلياً (Automated Key Rotation)
   */
  async rotateSecret(keyName: string): Promise<SecretMetadata> {
    await this.ensureInitialized();
    if (keyName !== 'JWT_SECRET') {
      throw new ServiceUnavailableException('تدوير مفتاح التشفير يتطلب ترحيل البيانات المشفرة مع إصدارات المفاتيح');
    }
    if (!this.isVaultOnline || !this.vaultToken) {
      this.recordAudit('ROTATE_SECRET', keyName, 'REJECTED_NO_DURABLE_VAULT');
      throw new ServiceUnavailableException(
        'التدوير الفوري معطل لأن Vault غير متصل؛ غيّر JWT_SECRET عبر إجراء صيانة ثم أعد تشغيل الخادم',
      );
    }

    this.logger.log(`🔄 جاري تدوير المفتاح الأمني (${keyName})...`);

    const newSecretValue = crypto.randomBytes(32).toString('hex');

    const current = this.secretsCache.get(keyName);
    const newVersion = (current?.version || 1) + 1;
    const now = new Date();

    let response: Response;
    try {
      response = await fetch(this.secretUrl(keyName), {
        method: 'POST',
        headers: {
          'X-Vault-Token': this.vaultToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { value: newSecretValue, rotatedAt: now.toISOString() } }),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error: any) {
      this.recordAudit('ROTATE_SECRET', keyName, 'VAULT_WRITE_FAILED');
      throw new BadGatewayException(`تعذر حفظ المفتاح الجديد في Vault: ${error.message}`);
    }
    if (!response.ok) {
      this.recordAudit('ROTATE_SECRET', keyName, `VAULT_HTTP_${response.status}`);
      throw new BadGatewayException(`رفض Vault تدوير المفتاح (HTTP ${response.status})`);
    }

    const payload = await response.json().catch(() => ({}));
    const persistedVersion = Number(payload?.data?.version);
    const version = Number.isInteger(persistedVersion) && persistedVersion > 0 ? persistedVersion : newVersion;
    this.secretsCache.set(keyName, {
      value: newSecretValue,
      version,
      lastRotated: now,
      source: 'HASHICORP_VAULT',
    });

    this.recordAudit('ROTATE_SECRET', keyName, `NEW_VERSION_${version}`);
    this.logger.log(`✅ تم تدوير المفتاح (${keyName}) بنجاح إلى الإصدار رقم #${version}`);

    return this.secretMetadata(keyName, this.secretsCache.get(keyName)!);
  }

  /**
   * تشفير نص باستخدام خوارزمية AES-256-GCM مع المفتاح الرئيسي
   */
  async encrypt(plainText: string): Promise<string> {
    const masterKey = await this.getSecret('ENCRYPTION_KEY');
    const key = crypto.createHash('sha256').update(masterKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * فك تشفير نص مشفر باستخدام AES-256-GCM
   */
  async decrypt(cipherText: string): Promise<string> {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedData] = parts;
    const masterKey = await this.getSecret('ENCRYPTION_KEY');
    const key = crypto.createHash('sha256').update(masterKey).digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  getVaultStatus() {
    const keysList: SecretMetadata[] = [];
    this.secretsCache.forEach((value, key) => keysList.push(this.secretMetadata(key, value)));

    return {
      isVaultOnline: this.isVaultOnline,
      vaultAddr: this.vaultAddr,
      activeSecretsCount: this.secretsCache.size,
      secrets: keysList,
      recentAuditLogs: this.auditLog.slice(-10).reverse(),
    };
  }

  private async syncFromVault() {
    for (const keyName of this.managedSecretNames) {
      try {
        const response = await fetch(this.secretUrl(keyName), {
          headers: { 'X-Vault-Token': this.vaultToken },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
        if (!response.ok) continue;
        const json = await response.json();
        const value = json?.data?.data?.value;
        if (typeof value !== 'string' || !value) continue;
        this.secretsCache.set(keyName, {
          value,
          version: Number(json?.data?.metadata?.version) || 1,
          lastRotated: json?.data?.data?.rotatedAt ? new Date(json.data.data.rotatedAt) : new Date(),
          source: 'HASHICORP_VAULT',
        });
      } catch (error: any) {
        this.logger.warn(`تعذر مزامنة ${keyName} من Vault: ${error.message}`);
      }
    }
  }

  private secretUrl(keyName: string) {
    return `${this.vaultAddr}/v1/secret/data/saraya-livestock/${encodeURIComponent(keyName)}`;
  }

  private secretMetadata(keyName: string, value: CachedSecret): SecretMetadata {
    const isJwt = keyName === 'JWT_SECRET';
    const rotationAvailable = isJwt && this.isVaultOnline;
    return {
      keyName,
      version: value.version,
      lastRotated: value.lastRotated,
      source: value.source,
      rotationAvailable,
      rotationUnavailableReason: rotationAvailable
        ? null
        : isJwt
          ? 'يتطلب اتصالاً نشطاً بـ HashiCorp Vault لضمان الحفظ الدائم'
          : 'يتطلب إصدار ciphertext وترحيل إعادة تشفير قبل السماح بالتدوير',
    };
  }

  private recordAudit(action: string, key: string, status: string) {
    this.auditLog.push({
      timestamp: new Date(),
      action,
      key,
      status,
    });
    if (this.auditLog.length > 200) this.auditLog.shift();
  }
}
