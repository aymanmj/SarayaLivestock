import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين - SarayaLivestock API')
    .setDescription('واجهات برمجة التطبيقات المتكاملة لإدارة القطيع، التناسل، الحلب، التسمين، التغذية، والمالية')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Short-lived access token bound to a revocable server session',
    })
    .addTag('animals', 'إدارة سجلات الحيوانات وشجرة النسب')
    .addTag('milking', 'تسجيل الحلبات ومطابقة الخزان العام')
    .addTag('breeding', 'محرك التناسل وحسابات الولادات والتجفيف')
    .addTag('health', 'السجل البيطري وصمام أمان فترة التحريم')
    .addTag('fattening', 'سجلات الوزن ومعدل التحويل الغذائي ADG')
    .addTag('nutrition', 'محرك تركيب العلائق بأقل تكلفة وصرف المخزون')
    .addTag('reports', 'التقارير التنفيذية ولوحة التحكم')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
