import { Module } from '@nestjs/common';
import { KeepAlive } from './keepalive.service.js';

@Module({
  providers: [KeepAlive],
})
export class KeepAliveModule {}