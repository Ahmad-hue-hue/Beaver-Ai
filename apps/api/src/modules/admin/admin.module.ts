import { Module } from '@nestjs/common';
import { AdminBootstrapService } from './admin-bootstrap.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrapService],
})
export class AdminModule {}