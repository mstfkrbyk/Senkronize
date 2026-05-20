import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SessionService } from './session.service';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth/sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @SkipThrottle()
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aktif oturumları listele' })
  @ApiResponse({ status: 200, description: 'Oturum listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('currentSessionId') currentSessionId?: string,
  ) {
    return this.sessionService.getActiveSessions(user.id, currentSessionId);
  }

  @SkipThrottle()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Belirli oturumu sonlandır' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  @ApiResponse({ status: 404, description: 'Oturum bulunamadı' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<{ ok: true }> {
    await this.sessionService.revokeSession(user.id, sessionId);
    return { ok: true };
  }

  @SkipThrottle()
  @Delete()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tüm diğer oturumları sonlandır (mevcut hariç)' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  async revokeAllOtherSessions(
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
}
