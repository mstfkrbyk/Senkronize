import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { parseCsvRows } from './migration.parse-csv';
import { MigrationService } from './migration.service';
import type {
  MigrationHistoryItem,
  MigrationImportResult,
} from './migration.types';

const CSV_MAX_BYTES = 10 * 1024 * 1024;
const CSV_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

@ApiTags('Geçiş')
@ApiBearerAuth()
@Controller('migration')
@UseGuards(JwtAuthGuard)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('import-products')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CSV_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype ?? '').toLowerCase();
        if (mime.length === 0 || CSV_MIMES.has(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Geçersiz dosya türü. Yalnızca CSV dosyası yükleyebilirsiniz.',
          ),
          false,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'CSV ile ürün içe aktar' })
  @ApiResponse({ status: 201, description: 'İçe aktarma tamamlandı' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  async importProducts(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<MigrationImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV dosyası gerekli');
    }
    const csv = file.buffer.toString('utf-8');
    const rows = parseCsvRows(csv);
    return this.migrationService.importProducts(rows, org.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'İçe aktarma geçmişi listesi' })
  @ApiResponse({ status: 200, description: 'Org kapsamlı geçmiş listesi (boş olabilir)' })
  async getHistory(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<MigrationHistoryItem[]> {
    return this.migrationService.getImportHistory(org.id);
  }
}
