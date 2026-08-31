import { Body, Controller, Delete, Get, Module, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PERMISSIONS } from '@beaver/shared';
import { BusinessId, RequirePermissions } from '../../common/auth/decorators.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

class CreateUnitDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsString() @MinLength(1) @MaxLength(12) abbreviation!: string;
  @IsOptional() @IsBoolean() allowsDecimal?: boolean;
}

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  list(businessId: string) {
    return this.prisma.unit.findMany({ where: { businessId }, orderBy: { name: 'asc' } });
  }

  create(businessId: string, dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        businessId,
        name: dto.name.trim(),
        abbreviation: dto.abbreviation.trim(),
        allowsDecimal: dto.allowsDecimal ?? false,
      },
    });
  }

  async remove(businessId: string, id: string) {
    const found = await this.prisma.unit.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!found) throw new NotFoundException('Unit not found.');
    await this.prisma.unit.delete({ where: { id } });
    return { success: true };
  }
}

@ApiTags('units')
@Controller('units')
class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_VIEW)
  list(@BusinessId() businessId: string) {
    return this.units.list(businessId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  create(@BusinessId() businessId: string, @Body() dto: CreateUnitDto) {
    return this.units.create(businessId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MANAGE)
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.units.remove(businessId, id);
  }
}

@Module({
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
