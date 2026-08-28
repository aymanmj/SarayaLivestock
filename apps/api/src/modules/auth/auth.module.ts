import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { SecurityModule } from '../../common/security/security.module';
import { VaultService } from '../../common/security/vault.service';

@Module({
  imports: [
    ConfigModule,
    SecurityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService, VaultService],
      useFactory: async (configService: ConfigService, vaultService: VaultService) => {
        const secret = await vaultService.getSecret('JWT_SECRET');
        if (secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRATION') || '15m',
          } as any,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy, JwtModule],
})
export class AuthModule {}
