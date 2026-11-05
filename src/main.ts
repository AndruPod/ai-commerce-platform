import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './common/domain-error.filter';

export function configureApp(app: Awaited<ReturnType<typeof NestFactory.create>>): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new DomainErrorFilter(app.get(HttpAdapterHost).httpAdapter));
  // Lets the demo frontend (a separate origin) call the API from the browser.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3002').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, methods: ['GET', 'POST'] });
  app.enableShutdownHooks();
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`VSA commerce API listening on http://localhost:${port}`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
