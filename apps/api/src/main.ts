import 'dotenv/config';

import { join } from 'node:path';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  app.register(fastifyStatic, {
    root: join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
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
        _request: import('fastify').FastifyRequest,
        reply: import('fastify').FastifyReply,
      ) => {
        reply.sendFile('index.html');
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
