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
  Query,
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
import { PermissionGuard } from '../auth/permission.guard';
import { Permission } from '../auth/permissions';
import { RequiresPermission } from '../auth/requires-permission.decorator';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  InviteUserDto,
  TransferOwnershipDto,
  UpdateNotificationPreferencesDto,
  UpdateUserRoleDto,
} from './users.dto';
import { SessionService } from '../auth/session.service';
import { UserInviteService } from './user-invite.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userInviteService: UserInviteService,
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequiresPermission(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'Organizasyondaki kullanıcıları listele' })
  @ApiResponse({ status: 200, description: 'Kullanıcı listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async list(@CurrentOrg() org: CurrentOrgPayload) {
    return this.usersService.getOrgUsers(org.id);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequiresPermission(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'Bekleyen davetleri listele' })
  @ApiResponse({ status: 200, description: 'Davet listesi' })
  async listInvites(@CurrentOrg() org: CurrentOrgPayload) {
    return this.userInviteService.listInvites(org.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aktif oturumlarım' })
  @ApiResponse({ status: 200, description: 'Oturum listesi' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('currentSessionId') currentSessionId?: string,
  ) {
    return this.sessionService.getActiveSessions(user.id, currentSessionId);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequiresPermission(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'E-posta ile kullanıcı davet et' })
  @ApiResponse({ status: 201, description: 'Davet oluşturuldu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  @ApiResponse({ status: 409, description: 'Çakışma' })
  async invite(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.userInviteService.inviteUser(
      org.id,
      actor.id,
      dto.email,
      dto.role,
    );
  }

  @Post('invites/:id/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequiresPermission(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Daveti yeniden gönder' })
  @ApiResponse({ status: 200, description: 'Gönderildi' })
  async resendInvite(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.userInviteService.resendInvite(org.id, id);
    return { ok: true };
  }

  @Delete('invites/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequiresPermission(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Daveti iptal et' })
  @ApiResponse({ status: 200, description: 'İptal edildi' })
  async cancelInvite(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.userInviteService.cancelInvite(org.id, id);
    return { ok: true };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Belirli oturumu sonlandır' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<{ ok: true }> {
    await this.sessionService.revokeSession(user.id, sessionId);
    return { ok: true };
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tüm diğer oturumları sonlandır' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('exceptSessionId') exceptSessionId?: string,
  ): Promise<{ ok: true }> {
    if (exceptSessionId) {
      await this.sessionService.revokeAllOtherSessions(user.id, exceptSessionId);
    } else {
      const sessions = await this.sessionService.getActiveSessions(user.id);
      await Promise.all(
        sessions.map((s) => this.sessionService.revokeSession(user.id, s.id)),
      );
    }
    return { ok: true };
  }

  @Post('transfer-ownership')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Organizasyon sahipliğini devret' })
  @ApiResponse({ status: 200, description: 'Devredildi' })
  async transferOwnership(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: TransferOwnershipDto,
  ): Promise<{ ok: true }> {
    await this.usersService.transferOwnership(org.id, actor.id, dto.newOwnerId);
    return { ok: true };
  }

  @Get('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bildirim tercihleri' })
  @ApiResponse({ status: 200, description: 'Tercihler' })
  async getNotificationPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getNotificationPreferences(
      user.id,
      user.currentOrgId,
    );
  }

  @Patch('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bildirim tercihlerini güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateNotificationPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(
      user.id,
      user.currentOrgId,
      dto,
    );
  }

  @Post('export-data')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'KVKK veri dışa aktarma talebi' })
  @ApiResponse({ status: 200, description: 'Talep alındı' })
  async requestDataExport(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    await this.usersService.requestDataExport(user.id, user.currentOrgId);
    return {
      message:
        'Veri dışa aktarma talebiniz alındı. 30 dakika içinde e-posta adresinize gönderilecektir.',
    };
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequiresPermission(Permission.USERS_MANAGE)
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @RequiresPermission(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Kullanıcıyı organizasyondan çıkar' })
  @ApiResponse({ status: 200, description: 'Çıkarıldı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.usersService.removeUserFromOrg(org.id, id, actor.id);
    return { ok: true };
  }
}
