import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';

interface TwoFaSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '········';
  }
  return `${secret.slice(0, 4)}········${secret.slice(-4)}`;
}

function downloadBackupCodes(codes: string[]): void {
  const blob = new Blob([codes.join('\n')], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'senkronize-2fa-yedek-kodlar.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export function TwoFactorSettings(): ReactElement {
  const queryClient = useQueryClient();
  const authQuery = useAuth();
  const twoFactorEnabled = authQuery.data?.user.twoFactorEnabled ?? false;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [setupPayload, setSetupPayload] = useState<TwoFaSetupResponse | null>(
    null,
  );
  const [otp, setOtp] = useState('');
  const [secretRevealed, setSecretRevealed] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');

  const [backupInfoOpen, setBackupInfoOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenToken, setRegenToken] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wizardOpen && wizardStep === 2) {
      otpRef.current?.focus();
    }
  }, [wizardOpen, wizardStep]);

  const resetWizard = useCallback((): void => {
    setWizardStep(1);
    setSetupPayload(null);
    setOtp('');
    setSecretRevealed(false);
  }, []);

  const setupMutation = useMutation({
    mutationFn: async (): Promise<TwoFaSetupResponse> => {
      const { data } = await api.post<TwoFaSetupResponse>('/auth/2fa/setup');
      return data;
    },
    onSuccess: (data) => {
      setSetupPayload(data);
      setWizardStep(1);
      setWizardOpen(true);
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/auth/2fa/verify', {
        token: otp.replace(/\D/g, '').slice(0, 6),
      });
    },
    onSuccess: () => {
      setWizardStep(3);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('İki adımlı doğrulama etkinleştirildi.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post('/auth/2fa/disable', {
        password: disablePassword,
        token: disableToken.trim(),
      });
    },
    onSuccess: () => {
      toast.success('İki adımlı doğrulama kapatıldı.');
      setDisableOpen(false);
      setDisablePassword('');
      setDisableToken('');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const regenMutation = useMutation({
    mutationFn: async (): Promise<string[]> => {
      const { data } = await api.post<{ backupCodes: string[] }>(
        '/auth/2fa/regenerate-backup',
        { token: regenToken.trim() },
      );
      return data.backupCodes;
    },
    onSuccess: (codes) => {
      setNewBackupCodes(codes);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Yeni yedek kodlar oluşturuldu.');
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const masked = useMemo(
    () => (setupPayload ? maskSecret(setupPayload.secret) : ''),
    [setupPayload],
  );

  const handleStartSetup = (): void => {
    resetWizard();
    setupMutation.mutate();
  };

  const handleCopySecret = async (): Promise<void> => {
    if (!setupPayload) {
      return;
    }
    try {
      await navigator.clipboard.writeText(setupPayload.secret);
      toast.success('Gizli anahtar panoya kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  };

  const handleCopyAllBackups = async (codes: string[]): Promise<void> => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Yedek kodlar panoya kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  };

  return (
    <>
      {authQuery.isLoading ? (
        <Skeleton className="h-48 w-full max-w-2xl" />
      ) : (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">İki adımlı doğrulama (2FA)</CardTitle>
            <CardDescription>
              Hesabınızı şifre çalınsa bile ek bir doğrulama katmanı ile koruyun.
            </CardDescription>
          </div>
          {twoFactorEnabled ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Aktif</Badge>
          ) : (
            <Badge variant="secondary">Kapalı</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!twoFactorEnabled ? (
            <>
              <p className="text-sm text-muted-foreground">
                Google Authenticator, Authy veya uyumlu bir uygulama ile TOTP
                kodları kullanılır. Etkinleştirdiğinizde girişte ek doğrulama
                istenir; cihazınıza erişemezseniz yedek kodlarınızı kullanın.
              </p>
              <Button
                type="button"
                onClick={() => {
                  handleStartSetup();
                }}
                disabled={setupMutation.isPending}
              >
                {setupMutation.isPending ? 'Hazırlanıyor…' : '2FA kurulumunu başlat'}
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDisablePassword('');
                  setDisableToken('');
                  setDisableOpen(true);
                }}
              >
                Devre dışı bırak
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBackupInfoOpen(true);
                }}
              >
                Yedek kodları görüntüle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWizardOpen(false);
            resetWizard();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === 1 && '1. Uygulamayı bağlayın'}
              {wizardStep === 2 && '2. Kodu doğrulayın'}
              {wizardStep === 3 && '3. Yedek kodlarınız'}
              {wizardStep === 4 && '4. Tamamlandı'}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1 &&
                'Google Authenticator veya Authy ile QR kodu tarayın veya gizli anahtarı girin.'}
              {wizardStep === 2 &&
                'Authenticator uygulamasındaki 6 haneli kodu girerek etkinleştirin.'}
              {wizardStep === 3 &&
                'Bu kodları yalnızca bir kez gösteriyoruz. Güvenli bir yerde saklayın.'}
              {wizardStep === 4 && '2FA hesabınız için hazır.'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 && setupPayload ? (
            <div className="space-y-4">
              <div className="flex justify-center rounded-md border border-border bg-card p-3">
                <img
                  src={setupPayload.qrCodeDataUrl}
                  alt="2FA QR kodu"
                  className="h-44 w-44"
                />
              </div>
              <div className="space-y-2">
                <Label>Manuel gizli anahtar</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={secretRevealed ? setupPayload.secret : masked}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSecretRevealed((v) => !v);
                    }}
                  >
                    {secretRevealed ? 'Gizle' : 'Göster'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void handleCopySecret();
                    }}
                  >
                    Kopyala
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setWizardStep(2)}>
                  Devam
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {wizardStep === 2 && setupPayload ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tfa-otp">Doğrulama kodu</Label>
                <Input
                  id="tfa-otp"
                  ref={otpRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(v);
                  }}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWizardStep(1)}
                >
                  Geri
                </Button>
                <Button
                  type="button"
                  disabled={otp.length !== 6 || enableMutation.isPending}
                  onClick={() => enableMutation.mutate()}
                >
                  {enableMutation.isPending ? 'Etkinleştiriliyor…' : 'Etkinleştir'}
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {wizardStep === 3 && setupPayload ? (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Dikkat</AlertTitle>
                <AlertDescription>
                  Bu kodları güvenli bir yerde saklayın. Telefonunuza erişemediğinizde
                  hesaba giriş için kullanılır; her kod yalnızca bir kez geçerlidir.
                </AlertDescription>
              </Alert>
              <ul className="grid grid-cols-1 gap-1 rounded-md border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-2">
                {setupPayload.backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void handleCopyAllBackups(setupPayload.backupCodes);
                  }}
                >
                  Tümünü kopyala
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadBackupCodes(setupPayload.backupCodes);
                  }}
                >
                  İndir (.txt)
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setWizardStep(4);
                  }}
                >
                  Anladım, devam
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {wizardStep === 4 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                İki adımlı doğrulama etkin. Bundan sonra girişte şifrenizin yanında
                uygulamanızdaki kodu girmeniz istenecek.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setWizardOpen(false);
                    resetWizard();
                  }}
                >
                  Kapat
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>2FA kapat</DialogTitle>
            <DialogDescription>
              Hesap şifrenizi ve authenticator uygulamasındaki 6 haneli kodu veya
              kayıtlı bir yedek kodu girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Şifre</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-tfa">Doğrulama kodu</Label>
              <Input
                id="disable-tfa"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value)}
                placeholder="123456 veya yedek kod"
                autoComplete="one-time-code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisableOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                disablePassword.length < 8 ||
                disableToken.trim().length < 6 ||
                disableMutation.isPending
              }
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? 'Kapatılıyor…' : 'Devre dışı bırak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={backupInfoOpen}
        onOpenChange={(o) => {
          setBackupInfoOpen(o);
          if (!o) {
            setRegenOpen(false);
            setRegenToken('');
            setNewBackupCodes(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yedek kodlar</DialogTitle>
            <DialogDescription>
              Güvenlik nedeniyle kayıtlı yedek kodlarınızı tekrar gösteremiyoruz.
              Yeni bir kod seti üretmek için kimliğinizi doğrulamanız gerekir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setBackupInfoOpen(false)}>
              Kapat
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBackupInfoOpen(false);
                setRegenOpen(true);
                setRegenToken('');
                setNewBackupCodes(null);
              }}
            >
              Yeni yedek kodlar üret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni yedek kodlar</DialogTitle>
            <DialogDescription>
              6 haneli TOTP veya mevcut bir yedek kod girin. Yeni kodlar üretildiğinde
              eski yedek kodlar geçersiz olur.
            </DialogDescription>
          </DialogHeader>
          {!newBackupCodes ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="regen-tfa">Kod</Label>
                <Input
                  id="regen-tfa"
                  value={regenToken}
                  onChange={(e) => setRegenToken(e.target.value)}
                  placeholder="123456 veya yedek kod"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRegenOpen(false)}>
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  disabled={regenToken.trim().length < 6 || regenMutation.isPending}
                  onClick={() => regenMutation.mutate()}
                >
                  {regenMutation.isPending ? 'Üretiliyor…' : 'Üret'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Saklayın</AlertTitle>
                <AlertDescription>
                  Bu pencereyi kapattıktan sonra kodları tekrar göremezsiniz.
                </AlertDescription>
              </Alert>
              <ul className="grid grid-cols-1 gap-1 rounded-md border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-2">
                {newBackupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void handleCopyAllBackups(newBackupCodes);
                  }}
                >
                  Kopyala
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadBackupCodes(newBackupCodes);
                  }}
                >
                  İndir
                </Button>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setRegenOpen(false);
                    setBackupInfoOpen(false);
                    setRegenToken('');
                    setNewBackupCodes(null);
                  }}
                >
                  Tamam
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
