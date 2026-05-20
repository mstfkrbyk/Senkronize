import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { getApiErrorMessage, api } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { useAuthStore } from '@/store/auth.store';
import type { LoginResponse, MeResponse, TokenPair } from '@/types/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, FORM_MESSAGES.required)
    .email(FORM_MESSAGES.email),
  password: z.string().min(1, FORM_MESSAGES.required),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function isTokenPair(r: LoginResponse): r is TokenPair {
  return 'accessToken' in r && 'refreshToken' in r;
}

function SixDigitInputs(props: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  idPrefix: string;
}): ReactElement {
  const { value, onChange, disabled, idPrefix } = props;
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const chars = value.padEnd(6, ' ').slice(0, 6).split('');

  const focusAt = (i: number): void => {
    const el = refs.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const setCharAt = (index: number, ch: string): void => {
    const next = value.padEnd(6, ' ').split('');
    next[index] = ch;
    onChange(next.join('').replace(/ /g, '').slice(0, 6));
  };

  return (
    <div
      className="flex justify-center gap-2"
      role="group"
      aria-label="6 haneli doğrulama kodu"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Input
          key={i}
          id={`${idPrefix}-${i}`}
          aria-label={`Doğrulama kodu rakam ${i + 1}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          className="h-12 w-10 text-center font-mono text-lg"
          value={chars[i]?.trim() === '' ? '' : chars[i]}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1);
            if (!d) {
              const arr = value.split('');
              arr.pop();
              onChange(arr.join(''));
              if (i > 0) {
                focusAt(i - 1);
              }
              return;
            }
            setCharAt(i, d);
            if (i < 5) {
              focusAt(i + 1);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !chars[i]?.trim() && i > 0) {
              focusAt(i - 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            onChange(pasted);
            const nextFocus = Math.min(pasted.length, 5);
            requestAnimationFrame(() => focusAt(nextFocus));
          }}
        />
      ))}
    </div>
  );
}

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

  const [phase, setPhase] = useState<'credentials' | 'twoFactor'>('credentials');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [totpValue, setTotpValue] = useState('');
  const [backupValue, setBackupValue] = useState('');

  const lastSubmittedTotp = useRef<string | null>(null);

  const from =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? (location.state as { from: string }).from
      : null;

  const form = useForm<LoginFormValues>({
    resolver: zodFormResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const finishLogin = useCallback(
    async (tokens: TokenPair): Promise<void> => {
      setTokens(tokens.accessToken, tokens.refreshToken, tokens.sessionId);
      const { data: me } = await api.get<MeResponse>('/auth/me');
      queryClient.setQueryData(['auth', 'me'], me);
      setUser({
        id: me.user.id,
        email: me.user.email,
        name: me.user.name,
        role: me.user.role,
      });
      setOrg({
        id: me.organization.id,
        name: me.organization.name,
        slug: me.organization.slug,
        type: me.organization.type,
        onboardingCompleted: me.organization.onboardingCompleted,
        plan: me.organization.plan,
      });
    },
    [queryClient, setOrg, setTokens, setUser],
  );

  const navigateAfterLogin = useCallback((): void => {
    toast.success('Giriş başarılı.');
    const inviteToken = searchParams.get('inviteToken');
    if (inviteToken) {
      navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
      return;
    }
    const target =
      from && from.startsWith('/') && !from.startsWith('/login')
        ? from
        : '/dashboard';
    navigate(target, { replace: true });
  }, [from, navigate, searchParams]);

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues): Promise<LoginResponse> => {
      const { data } = await api.post<LoginResponse>('/auth/login', {
        email: values.email,
        password: values.password,
      });
      return data;
    },
    onSuccess: async (data) => {
      if ('requiresTwoFactor' in data && data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setPhase('twoFactor');
        setUseBackupCode(false);
        setTotpValue('');
        setBackupValue('');
        lastSubmittedTotp.current = null;
        return;
      }
      if (isTokenPair(data)) {
        await finishLogin(data);
        navigateAfterLogin();
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const twoFactorMutation = useMutation({
    mutationFn: async (): Promise<TokenPair> => {
      if (!tempToken) {
        throw new Error('Oturum doğrulaması eksik');
      }
      const code = useBackupCode ? backupValue.trim() : totpValue;
      const { data } = await api.post<TokenPair>('/auth/2fa/verify', {
        tempToken,
        code,
      });
      return data;
    },
    onSuccess: async (tokens) => {
      await finishLogin(tokens);
      navigateAfterLogin();
    },
    onError: (error: unknown) => {
      lastSubmittedTotp.current = null;
      toast.error(getApiErrorMessage(error));
    },
  });

  useEffect(() => {
    document.title = 'Giriş — Senkronize';
  }, []);

  useEffect(() => {
    if (
      phase === 'twoFactor' &&
      !useBackupCode &&
      totpValue.length === 6 &&
      !twoFactorMutation.isPending &&
      lastSubmittedTotp.current !== totpValue
    ) {
      lastSubmittedTotp.current = totpValue;
      twoFactorMutation.mutate();
    }
  }, [phase, useBackupCode, totpValue, twoFactorMutation]);

  if (token) {
    const inviteToken = searchParams.get('inviteToken');
    if (inviteToken) {
      return (
        <Navigate
          to={`/invite/${encodeURIComponent(inviteToken)}`}
          replace
        />
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (phase === 'twoFactor') {
    return (
      <Card className="mx-auto w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader>
          <CardTitle>İki adımlı doğrulama</CardTitle>
          <CardDescription>
            Hesabınızda 2FA etkin. Authenticator uygulamanızdaki kodu girin veya yedek
            kod kullanın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="backup-toggle" className="text-base">
                Yedek kod kullan
              </Label>
              <p className="text-sm text-muted-foreground">
                Telefonunuza erişemiyorsanız kayıtlı yedek kodlardan birini girin.
              </p>
            </div>
            <Switch
              id="backup-toggle"
              checked={useBackupCode}
              onCheckedChange={(c) => {
                setUseBackupCode(Boolean(c));
                setTotpValue('');
                setBackupValue('');
                lastSubmittedTotp.current = null;
              }}
            />
          </div>
          {!useBackupCode ? (
            <div className="space-y-2">
              <Label>6 haneli kod</Label>
              <SixDigitInputs
                idPrefix="login-tfa"
                value={totpValue}
                disabled={twoFactorMutation.isPending}
                onChange={setTotpValue}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="backup-code">Yedek kod</Label>
              <Input
                id="backup-code"
                aria-label="Yedek kod"
                placeholder="XXXXXXXX-XXXXXXXX"
                className="font-mono uppercase text-base"
                value={backupValue}
                disabled={twoFactorMutation.isPending}
                onChange={(e) => setBackupValue(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {useBackupCode ? (
            <Button
              type="button"
              className="w-full"
              disabled={
                backupValue.trim().length < 6 || twoFactorMutation.isPending
              }
              onClick={() => twoFactorMutation.mutate()}
            >
              {twoFactorMutation.isPending ? 'Doğrulanıyor…' : 'Giriş yap'}
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              6 rakamı girdiğinizde otomatik olarak doğrulanır.
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={loginMutation.isPending || twoFactorMutation.isPending}
            onClick={() => {
              setPhase('credentials');
              setTempToken(null);
              setTotpValue('');
              setBackupValue('');
              lastSubmittedTotp.current = null;
            }}
          >
            Geri (e-posta / şifre)
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle>Giriş yap</CardTitle>
        <CardDescription>
          Senkronize paneline erişmek için bilgilerinizi girin.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => loginMutation.mutate(values))}
        >
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="ornek@sirket.com"
                      className="text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifre</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hesabınız yok mu?{' '}
              <Link
                to="/register"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Kayıt olun
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
