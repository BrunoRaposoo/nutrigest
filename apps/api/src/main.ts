import 'dotenv/config';

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { NutrigestFastifyAdapter } from './common/adapters/nutrigest-fastify.adapter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new NutrigestFastifyAdapter({ logger: true, trustProxy: true }),
  );

  app.setGlobalPrefix('api');

  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  const uploadsDir = join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.register(fastifyMultipart, {
    limits: {
      fileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
    },
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (process.env.NODE_ENV === 'production') {
    await app.register(fastifyStatic, {
      root: join(__dirname, '..', '..', 'public'),
      prefix: '/',
      decorateReply: false,
    });

    const instance = app
      .getHttpAdapter()
      .getInstance() as import('fastify').FastifyInstance;
    instance.setNotFoundHandler(
      (
        request: import('fastify').FastifyRequest,
        reply: import('fastify').FastifyReply,
      ) => {
        if (
          request.url.startsWith('/api') ||
          request.url.startsWith('/uploads')
        ) {
          return reply.code(404).send({
            statusCode: 404,
            message: `Route ${request.method} ${request.url} not found`,
            error: 'Not Found',
          });
        }
        return reply.sendFile('index.html');
      },
    );
  }

  const config = new DocumentBuilder()
    .setTitle('Nutrigest API')
    .setDescription('API de controle de estoque nutricional')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
