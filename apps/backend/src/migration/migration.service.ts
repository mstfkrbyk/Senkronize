import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

import { STANDARD_QUEUE_JOB_OPTIONS } from '../queue/bull-job.options';
import { QUEUE_DATA_IMPORT } from '../queue/queue.constants';
import type { DataImportJobData } from '../queue/queue.types';

import { detectSourceFormat } from './migration.format-detector';
import { MigrationImportExecutor } from './migration-import.executor';
import { suggestColumnMapping } from './migration.mapper';
import { parseMigrationFile } from './migration.parser';
import { parseCsvRows } from './migration.parse-csv';
import { MigrationSessionStore } from './migration-session.store';
import { validateMigrationRows } from './migration.validator';
import type {
  MigrationDataType,
  MigrationExecuteResponse,
  MigrationImportResult,
  MigrationPreviewResponse,
  MigrationRow,
  MigrationSession,
  MigrationStatusResponse,
  MigrationUploadResponse,
  MigrationValidationResult,
} from './migration.types';

const FILE_MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'text/xml',
  'application/xml',
  'application/octet-stream',
]);

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private readonly sessionStore: MigrationSessionStore,
    private readonly importExecutor: MigrationImportExecutor,
    @InjectQueue(QUEUE_DATA_IMPORT)
    private readonly dataImportQueue: Queue<DataImportJobData>,
  ) {}

  async uploadFile(
    organizationId: string,
    userId: string | undefined,
    file: Express.Multer.File,
    dataType: MigrationDataType,
    sourceFormatHint?: string,
  ): Promise<MigrationUploadResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya gerekli');
    }
    if (file.size > FILE_MAX_BYTES) {
      throw new BadRequestException('Dosya boyutu 15 MB sınırını aşıyor');
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    if (mime.length > 0 && !ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException('Desteklenmeyen dosya türü');
    }

    const fileName = file.originalname ?? 'upload.csv';
    const parsed = parseMigrationFile(
      file.buffer,
      fileName,
      mime,
      detectSourceFormat([], fileName, mime, sourceFormatHint),
    );

    const sourceFormat = detectSourceFormat(
      parsed.headers,
      fileName,
      mime,
      sourceFormatHint,
    );

    const reparsed =
      sourceFormat !== detectSourceFormat([], fileName, mime, sourceFormatHint)
        ? parseMigrationFile(file.buffer, fileName, mime, sourceFormat)
        : parsed;

    const session = await this.sessionStore.create({
      organizationId,
      userId,
      dataType,
      sourceFormat,
      fileName,
      mimeType: mime || 'application/octet-stream',
      headers: reparsed.headers,
      rawRows: reparsed.rows,
    });

    const suggested = suggestColumnMapping(reparsed.headers, dataType);
    await this.sessionStore.update(session.id, organizationId, {
      columnMapping: suggested,
    });

    return {
      sessionId: session.id,
      dataType,
      sourceFormat,
      totalRows: reparsed.rows.length,
      headers: reparsed.headers,
    };
  }

  async getPreview(
    sessionId: string,
    organizationId: string,
  ): Promise<MigrationPreviewResponse> {
    const session = await this.sessionStore.get(sessionId, organizationId);
    return {
      headers: session.headers,
      rows: session.rawRows.slice(0, 10),
      totalRows: session.rawRows.length,
    };
  }

  async mapColumns(
    sessionId: string,
    organizationId: string,
    columnMapping: Record<string, string>,
  ): Promise<MigrationSession> {
    return this.sessionStore.update(sessionId, organizationId, {
      columnMapping,
      status: 'mapped',
    });
  }

  async validate(
    sessionId: string,
    organizationId: string,
  ): Promise<MigrationValidationResult> {
    const session = await this.sessionStore.get(sessionId, organizationId);
    const result = validateMigrationRows(
      session.rawRows,
      session.columnMapping,
      session.sourceFormat,
      session.dataType,
    );
    await this.sessionStore.update(sessionId, organizationId, {
      validationResult: result,
      status: 'validated',
    });
    return result;
  }

  async execute(
    sessionId: string,
    organizationId: string,
  ): Promise<MigrationExecuteResponse> {
    const session = await this.sessionStore.get(sessionId, organizationId);
    if (session.rawRows.length === 0) {
      throw new BadRequestException('İçe aktarılacak satır yok');
    }

    const job = await this.dataImportQueue.add(
      'execute-import',
      { sessionId, organizationId },
      STANDARD_QUEUE_JOB_OPTIONS,
    );

    await this.sessionStore.update(sessionId, organizationId, {
      status: 'queued',
      progress: {
        ...session.progress,
        total: session.rawRows.length,
        processed: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    });

    return {
      jobId: String(job.id),
      sessionId,
    };
  }

  async getStatus(
    sessionId: string,
    organizationId: string,
  ): Promise<MigrationStatusResponse> {
    const session = await this.sessionStore.get(sessionId, organizationId);
    return {
      sessionId: session.id,
      status: session.status,
      progress: session.progress,
      validation: session.validationResult,
    };
  }

  getErrorsCsv(session: MigrationSession): string {
    const lines = ['row,field,message'];
    for (const err of session.rowErrors) {
      const msg = err.message.replace(/"/g, '""');
      lines.push(`${err.row},"${err.field}","${msg}"`);
    }
    if (session.validationResult) {
      for (const err of session.validationResult.errors) {
        const msg = err.message.replace(/"/g, '""');
        lines.push(`${err.row},"${err.field}","${msg}"`);
      }
    }
    return lines.join('\n');
  }

  async processImportJob(
    sessionId: string,
    organizationId: string,
    onProgress?: (session: MigrationSession) => void,
  ): Promise<MigrationSession> {
    let session = await this.sessionStore.get(sessionId, organizationId);
    session = await this.sessionStore.update(sessionId, organizationId, {
      status: 'processing',
      progress: {
        ...session.progress,
        total: session.rawRows.length,
      },
    });

    let startIndex = 0;
    while (startIndex < session.rawRows.length) {
      const batch = await this.importExecutor.executeBatch(
        organizationId,
        session.dataType,
        session.sourceFormat,
        session.rawRows,
        session.columnMapping,
        startIndex,
        { ...session.progress },
      );

      startIndex += 100;
      const mergedErrors = [...session.rowErrors, ...batch.rowErrors];
      session = await this.sessionStore.update(sessionId, organizationId, {
        progress: batch.progress,
        rowErrors: mergedErrors,
      });
      onProgress?.(session);
    }

    return this.sessionStore.update(sessionId, organizationId, {
      status: 'completed',
    });
  }

  /** Eski CSV uç noktası — geriye dönük uyumluluk */
  async importProducts(
    rows: MigrationRow[],
    organizationId: string,
  ): Promise<MigrationImportResult> {
    const progress = {
      processed: 0,
      total: rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    for (const row of rows) {
      progress.processed++;
      try {
        if (!row.barcode || !row.name) {
          progress.skipped++;
          continue;
        }
        await this.importExecutor.executeBatch(
          organizationId,
          'products',
          'generic_csv',
          [
            {
              barcode: row.barcode,
              name: row.name,
              price: String(row.salePrice),
              stock: String(row.stock ?? 0),
              category: row.category ?? '',
              brand: row.brand ?? '',
              description: row.description ?? '',
              imageUrl: row.imageUrl ?? '',
            },
          ],
          {},
          0,
          progress,
        );
      } catch {
        progress.failed++;
      }
    }

    return this.importExecutor.toLegacyProductResult(progress);
  }

  async getImportHistory(_organizationId: string): Promise<unknown[]> {
    return [];
  }

  parseCsvForLegacy(csv: string): MigrationRow[] {
    return parseCsvRows(csv);
  }
}
