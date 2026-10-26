import { Module } from '@nestjs/common';

import { MockProviderController } from './mock-provider.controller';

@Module({ controllers: [MockProviderController] })
export class MockProviderModule {}
