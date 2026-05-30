import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, History, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useSocket } from '@/hooks/useSocket';
import { getApiErrorMessage } from '@/lib/api';
import type {
  MigrationDataType,
  MigrationProgressEvent,
  MigrationSessionProgress,
  MigrationValidationResult,
} from '@/types/migration';

import { ColumnMappingStep } from './components/ColumnMappingStep';
import { FileUploadStep } from './components/FileUploadStep';
import { ImportStep } from './components/ImportStep';
import { SourceSelectionStep } from './components/SourceSelectionStep';
import { ValidationStep } from './components/ValidationStep';
import { WizardStepIndicator } from './components/WizardStepIndicator';
import {
  DATA_TYPE_LABELS,
  MIGRATION_PLATFORMS,
  REQUIRED_FIELDS,
  buildErrorsCsv,
  downloadCsv,
  resolvePrimaryDataType,
  suggestColumnMapping,
  type MigrationPlatformId,
} from './migration.constants';
import {
  downloadMigrationErrors,
  useMigrationExecute,
  useMigrationMapColumns,
  useMigrationPreview,
  useMigrationStatus,
  useMigrationUpload,
  useMigrationValidate,
} from './hooks/useMigration';

const INITIAL_PROGRESS: MigrationSessionProgress = {
  processed: 0,
  total: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
};

export function MigrationPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const pageTitle = t('nav.migration');
  const navContextLine = formatNavPageContext(groupLabel, t('nav.migrationShort'));
  const pageSubtitle = t('migration.pageSubtitle');

  usePageTitle(pageTitle);
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<MigrationPlatformId | null>(null);
  const [selectedDataTypes, setSelectedDataTypes] = useState<MigrationDataType[]>(['products']);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [allowWarnings, setAllowWarnings] = useState(false);
  const [validationResult, setValidationResult] = useState<MigrationValidationResult | null>(
    null,
  );
  const [importStatus, setImportStatus] = useState<
    'idle' | 'running' | 'completed' | 'failed'
  >('idle');
  const [liveProgress, setLiveProgress] = useState<MigrationSessionProgress>(INITIAL_PROGRESS);

  const primaryDataType = useMemo(
    () => resolvePrimaryDataType(selectedDataTypes),
    [selectedDataTypes],
  );

  const platformOption = MIGRATION_PLATFORMS.find((p) => p.id === platform);

  const uploadMutation = useMigrationUpload();
  const mapMutation = useMigrationMapColumns();
  const validateMutation = useMigrationValidate();
  const executeMutation = useMigrationExecute();

  const previewQuery = useMigrationPreview(sessionId);
  const statusQuery = useMigrationStatus(
    sessionId,
    importStatus === 'running' || importStatus === 'idle',
  );

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }
    return on('migration:progress', (payload) => {
      const data = payload as MigrationProgressEvent;
      if (data.sessionId !== sessionId) {
        return;
      }
      setLiveProgress((prev) => ({
        ...prev,
        processed: data.processed,
        total: data.total,
        imported: data.imported,
        failed: data.failed,
      }));
      if (data.total > 0 && data.processed >= data.total) {
        setImportStatus('completed');
        void queryClient.invalidateQueries({ queryKey: ['migration'] });
      } else if (data.processed > 0) {
        setImportStatus('running');
      }
    });
  }, [on, sessionId, queryClient]);

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (!status) {
      return;
    }
    if (status === 'processing' || status === 'queued') {
      setImportStatus('running');
    }
    if (status === 'completed') {
      setImportStatus('completed');
    }
    if (status === 'failed') {
      setImportStatus('failed');
    }
    if (statusQuery.data?.progress) {
      setLiveProgress(statusQuery.data.progress);
    }
  }, [statusQuery.data]);

  const handleToggleDataType = useCallback((id: MigrationDataType, checked: boolean) => {
    setSelectedDataTypes((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((t) => t !== id);
    });
  }, []);

  const handleFileAccepted = useCallback(
    async (acceptedFile: File) => {
      if (!platformOption) {
        toast.error('Önce kaynak platform seçin');
        return;
      }
      setFile(acceptedFile);
      try {
        const upload = await uploadMutation.mutateAsync({
          file: acceptedFile,
          dataType: primaryDataType,
          sourceFormat: platformOption.sourceFormatHint,
        });
        setSessionId(upload.sessionId);
        const suggested = suggestColumnMapping(upload.headers, primaryDataType);
        setColumnMapping(suggested);
        toast.success('Dosya yüklendi');
      } catch (err) {
        toast.error(getApiErrorMessage(err));
        setFile(null);
      }
    },
    [platformOption, primaryDataType, uploadMutation],
  );

  const canProceedStep1 =
    platform !== null && selectedDataTypes.length > 0;

  const canProceedStep2 =
    Boolean(sessionId) &&
    Boolean(file) &&
    (previewQuery.data?.rows.length ?? 0) > 0 &&
    !uploadMutation.isPending;

  const requiredFields = REQUIRED_FIELDS[primaryDataType] ?? [];
  const canProceedStep3 = requiredFields.every((field) =>
    Boolean(columnMapping[field]?.trim()),
  );

  const canProceedStep4 = useMemo(() => {
    if (!validationResult) {
      return false;
    }
    if (validationResult.errors.length > 0) {
      return false;
    }
    if (validationResult.warnings.length > 0 && !allowWarnings) {
      return false;
    }
    return validationResult.valid > 0;
  }, [validationResult, allowWarnings]);

  const goNext = async (): Promise<void> => {
    if (step === 3) {
      if (!sessionId) {
        return;
      }
      try {
        await mapMutation.mutateAsync({ sessionId, columnMapping });
        setStep(4);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      }
      return;
    }
    if (step === 4 && canProceedStep4) {
      setStep(5);
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = (): void => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleValidate = async (): Promise<void> => {
    if (!sessionId) {
      return;
    }
    try {
      const result = await validateMutation.mutateAsync(sessionId);
      setValidationResult(result);
      if (result.errors.length === 0) {
        toast.success('Doğrulama tamamlandı');
      } else {
        toast.warning(`${result.errors.length} hata bulundu`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleStartImport = async (): Promise<void> => {
    if (!sessionId) {
      return;
    }
    try {
      await executeMutation.mutateAsync(sessionId);
      setImportStatus('running');
      toast.success('İçe aktarma başlatıldı');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleDownloadReport = async (): Promise<void> => {
    if (!sessionId) {
      return;
    }
    try {
      await downloadMigrationErrors(sessionId);
    } catch {
      if (validationResult?.errors.length) {
        downloadCsv(buildErrorsCsv(validationResult.errors), 'migration-rapor.csv');
      } else {
        toast.error('Rapor indirilemedi');
      }
    }
  };

  const previewRows = previewQuery.data?.rows ?? [];
  const previewHeaders = previewQuery.data?.headers ?? uploadMutation.data?.headers ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col space-y-6">
      <PageHeader
        title={pageTitle}
        description={pageSubtitle}
        context={navContextLine}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/migration/history">
              <History className="mr-2 size-4" />
              Geçmiş
            </Link>
          </Button>
        }
      />

      <WizardStepIndicator currentStep={step} />

      {selectedDataTypes.length > 1 && step > 1 ? (
        <p className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-muted-foreground">
          Bu oturumda öncelikli veri tipi:{' '}
          <strong className="text-foreground">{DATA_TYPE_LABELS[primaryDataType]}</strong>.
          Diğer tipler için işlem sonrası sihirbazı tekrar çalıştırın.
        </p>
      ) : null}

      {step === 1 ? (
        <SourceSelectionStep
          selectedPlatform={platform}
          selectedDataTypes={selectedDataTypes}
          onSelectPlatform={setPlatform}
          onToggleDataType={handleToggleDataType}
        />
      ) : null}

      {step === 2 ? (
        <FileUploadStep
          file={file}
          headers={previewHeaders}
          previewRows={previewRows}
          totalRows={previewQuery.data?.totalRows ?? uploadMutation.data?.totalRows ?? 0}
          isUploading={uploadMutation.isPending}
          onFileAccepted={handleFileAccepted}
        />
      ) : null}

      {step === 3 && sessionId ? (
        <ColumnMappingStep
          dataType={primaryDataType}
          sourceHeaders={previewHeaders}
          columnMapping={columnMapping}
          onMappingChange={(target, source) =>
            setColumnMapping((prev) => ({ ...prev, [target]: source }))
          }
        />
      ) : null}

      {step === 4 ? (
        <ValidationStep
          validationResult={validationResult}
          isValidating={validateMutation.isPending}
          allowWarnings={allowWarnings}
          onAllowWarningsChange={setAllowWarnings}
          onValidate={handleValidate}
          onDownloadErrors={() => undefined}
        />
      ) : null}

      {step === 5 ? (
        <ImportStep
          dataType={primaryDataType}
          progress={liveProgress.total > 0 ? liveProgress : statusQuery.data?.progress ?? INITIAL_PROGRESS}
          status={importStatus}
          isStarting={executeMutation.isPending}
          onStartImport={handleStartImport}
          onDownloadReport={() => void handleDownloadReport()}
        />
      ) : null}

      {step < 5 ? (
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
            <ChevronLeft className="mr-1 size-4" />
            Geri
          </Button>
          <Button
            type="button"
            onClick={() => void goNext()}
            disabled={
              (step === 1 && !canProceedStep1) ||
              (step === 2 && !canProceedStep2) ||
              (step === 3 && (!canProceedStep3 || mapMutation.isPending)) ||
              (step === 4 && !canProceedStep4) ||
              mapMutation.isPending
            }
          >
            {mapMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Kaydediliyor…
              </>
            ) : (
              <>
                İleri
                <ChevronRight className="ml-1 size-4" />
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
