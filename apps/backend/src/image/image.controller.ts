import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
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

import { PresignedUrlBodyDto } from './image.dto';
import { ImageService } from './image.service';

const IMAGE_UPLOAD_LIMIT = 5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

@ApiTags('Görseller')
@ApiBearerAuth()
@Controller('images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMAGE_UPLOAD_LIMIT },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype as (typeof ALLOWED_MIMES)[number])) {
          cb(
            new BadRequestException(
              'Geçersiz dosya türü. Yalnızca JPG, PNG veya WebP yükleyebilirsiniz.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
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
  @ApiOperation({ summary: 'Görsel yükle (R2)' })
  @ApiResponse({ status: 201, description: 'Yükleme başarılı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 503, description: 'Depolama yapılandırılmadı' })
  async upload(
    @CurrentOrg() org: CurrentOrgPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya gerekli');
    }
    const url = await this.imageService.upload(org.id, file);
    return { url };
  }

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'İstemci tarafı yükleme için presigned URL' })
  @ApiResponse({ status: 201, description: 'URL üretildi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 503, description: 'Depolama yapılandırılmadı' })
  async presignedUrl(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: PresignedUrlBodyDto,
  ): Promise<{ url: string; key: string }> {
    return this.imageService.getPresignedUrl(org.id, body.filename);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'R2 nesnesini sil',
    description:
      '`key` tam depolama anahtarıdır; eğik çizgiler içeriyorsa yol segmenti olarak `encodeURIComponent(key)` ile gönderin.',
  })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Bu anahtara erişim yok' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('key') encodedKey: string,
  ): Promise<{ ok: true }> {
    let key: string;
    try {
      key = decodeURIComponent(encodedKey);
    } catch {
      throw new BadRequestException('Geçersiz anahtar kodlaması');
    }
    if (!key.startsWith(`${org.id}/`)) {
      throw new ForbiddenException('Bu nesneyi silme yetkiniz yok');
    }
    await this.imageService.delete(key);
    return { ok: true };
  }
}
