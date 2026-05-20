import type { ReactElement } from 'react';
import { useState } from 'react';
import { Copy, Loader2, Mail, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useReportShare } from './hooks/useReportShare';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportName?: string;
}

export function ShareReportModal({
  open,
  onOpenChange,
  reportId,
  reportName,
}: Props): ReactElement {
  const { t } = useTranslation();
  const shareMutation = useReportShare();
  const [emailsText, setEmailsText] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  function resetState(): void {
    setEmailsText('');
    setShareUrl(null);
    setExpiresAt(null);
  }

  async function handleCreateLink(): Promise<void> {
    const result = await shareMutation.mutateAsync({
      reportId,
      payload: { createLink: true },
    });
    if (result.shareUrl) {
      setShareUrl(result.shareUrl);
      setExpiresAt(result.expiresAt ?? null);
    }
  }

  async function handleSendEmail(): Promise<void> {
    const emails = emailsText
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.error(t('reports.share.emailRequired'));
      return;
    }
    await shareMutation.mutateAsync({
      reportId,
      payload: { emails, createLink: false },
    });
    resetState();
    onOpenChange(false);
  }

  async function copyLink(): Promise<void> {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t('reports.share.linkCopied'));
    } catch {
      toast.error(t('reports.share.copyFailed'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetState();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('reports.share.title')}
          </DialogTitle>
          <DialogDescription>
            {reportName
              ? t('reports.share.descriptionNamed', { name: reportName })
              : t('reports.share.description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">{t('reports.share.linkTab')}</TabsTrigger>
            <TabsTrigger value="email">{t('reports.share.emailTab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('reports.share.linkHint')}</p>
            {shareUrl ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => void copyLink()}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    {t('reports.share.expiresAt', {
                      date: new Date(expiresAt).toLocaleString('tr-TR'),
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={shareMutation.isPending}
                onClick={() => void handleCreateLink()}
              >
                {shareMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                {t('reports.share.createLink')}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="share-emails">{t('reports.share.recipients')}</Label>
              <Input
                id="share-emails"
                placeholder="ornek@sirket.com"
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('reports.share.emailHint')}</p>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={shareMutation.isPending}
              onClick={() => void handleSendEmail()}
            >
              {shareMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {t('reports.share.sendEmail')}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
