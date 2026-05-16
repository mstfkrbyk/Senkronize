import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { InviteUserDto, UpdateUserRoleDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyondaki kullanıcıları listele' })
  @ApiResponse({ status: 200, description: 'Kullanıcı listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async list(@CurrentOrg() org: CurrentOrgPayload) {
    return this.usersService.list(org.id);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'E-posta ile kullanıcı oluştur (davet)' })
  @ApiResponse({ status: 201, description: 'Kullanıcı oluşturuldu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  @ApiResponse({ status: 409, description: 'E-posta zaten kayıtlı' })
  async invite(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.invite(org.id, dto);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Kullanıcı rolünü güncelle' })
  @ApiResponse({ status: 200, description: 'Rol güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
  async updateRole(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(org.id, actor.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Kullanıcıyı pasifleştir (soft delete)' })
  @ApiResponse({ status: 200, description: 'Kullanıcı pasifleştirildi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.usersService.softDelete(org.id, actor.id, id);
    return { ok: true };
  }
}
