import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (trustProxyHops > 0) app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3050,null')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());

  app.enableCors({
    origin: isProduction ? allowedOrigins : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Saraya-Client, Idempotency-Key',
  });

  // البادئة العامة للـ API
  app.setGlobalPrefix('api/v1');

  // التحقق التلقائي من صحة المدخلات
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  // توثيق Swagger للـ APIs
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`🚀 SarayaLivestock API Server is running on ${host}:${port}/api/v1`);
  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
    console.log(`📚 Interactive Swagger Docs available at: http://localhost:${port}/docs`);
  }
}

bootstrap();
