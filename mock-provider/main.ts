import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { MockProviderModule } from './mock-provider.module';

async function bootstrap() {
  const app = await NestFactory.create(MockProviderModule);
  const port = Number(process.env.MOCK_PROVIDER_PORT ?? 3001);

  await app.listen(port);

  Logger.log(
    `Mock provider listening on http://localhost:${port}/provider/v1/execute`,
    'MockProvider',
  );
}

void bootstrap();
