import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { MaintenanceService } from './maintenance.service.js';

@Module({
  imports: [PrismaModule],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}