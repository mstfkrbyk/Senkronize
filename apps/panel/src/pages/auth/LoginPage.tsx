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
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApiErrorMessage, api } from '@/lib/api';
import {
  clearRememberedLoginEmail,
  readRememberedLoginEmail,
  writeRememberedLoginEmail,
} from '@/lib/login-remember';
import {
  DEMO_LOGIN_ACCOUNTS,
  getDemoLoginPassword,
  isDemoMode,
} from '@/lib/demo-login';
import {
  getHepsiburadaQuickLoginCredentials,
  isHepsiburadaQuickLoginEnabled,
} from '@/lib/hepsiburada-quick-login';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { resolveAppHomePath } from '@/lib/app-home';
import { useAuthStore } from '@/store/auth.store';
import { useImpersonationStore } from '@/store/impersonation.store';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import { LoginPageProductLinesHint } from '@/pages/auth/LoginPageProductLinesHint';

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
  const [rememberMe, setRememberMe] = useState(
    () => readRememberedLoginEmail() !== null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const lastSubmittedTotp = useRef<string | null>(null);

  const from =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? (location.state as { from: string }).from
      : null;

  const form = useForm<LoginFormValues>({
    resolver: zodFormResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: readRememberedLoginEmail() ?? '',
      password: '',
    },
  });

  const finishLogin = useCallback(
    async (tokens: TokenPair): Promise<MeResponse> => {
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
        orgProducts: me.organization.orgProducts,
        accountingMode: me.organization.accountingMode,
      });
      if (me.organization.type === 'PARTNER' && !me.isImpersonating) {
        useImpersonationStore.getState().stopImpersonation();
      }
      return me;
    },
    [queryClient, setOrg, setTokens, setUser],
  );

  const navigateAfterLogin = useCallback(
    (me: MeResponse): void => {
      toast.success('Giriş başarılı.');
      const inviteToken = searchParams.get('inviteToken');
      if (inviteToken) {
        navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
        return;
      }
      const defaultHome = resolveAppHomePath({
        type: me.organization.type,
        orgProducts: me.organization.orgProducts,
        isImpersonating: me.isImpersonating,
        accountingMode: me.organization.accountingMode,
      });
      const target =
        from && from.startsWith('/') && !from.startsWith('/login')
          ? from
          : defaultHome;
      navigate(target, { replace: true });
    },
    [from, navigate, searchParams],
  );

  const loginMutation = useMutation({
    mutationFn: async (values: LoginFormValues): Promise<LoginResponse> => {
      const { data } = await api.post<LoginResponse>('/auth/login', {
        email: values.email,
        password: values.password,
      });
      return data;
    },
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: async (data, variables) => {
      if (rememberMe) {
        writeRememberedLoginEmail(variables.email);
      } else {
        clearRememberedLoginEmail();
      }
      if ('requiresTwoFactor' in data && data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setPhase('twoFactor');
        setUseBackupCode(false);
        setTotpValue('');
        setBackupValue('');
        setFormError(null);
        lastSubmittedTotp.current = null;
        return;
      }
      if (isTokenPair(data)) {
        const me = await finishLogin(data);
        navigateAfterLogin(me);
      }
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
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
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: async (tokens) => {
      const me = await finishLogin(tokens);
      navigateAfterLogin(me);
    },
    onError: (error: unknown) => {
      lastSubmittedTotp.current = null;
      setFormError(getApiErrorMessage(error));
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
    const org = useAuthStore.getState().currentOrg;
    const home = resolveAppHomePath({
      type: org?.type,
      orgProducts: org?.orgProducts,
      isImpersonating: false,
      accountingMode: org?.accountingMode,
    });
    return <Navigate to={home} replace />;
  }

  if (phase === 'twoFactor') {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>İki adımlı doğrulama</CardTitle>
          <CardDescription>
            Hesabınızda 2FA etkin. Authenticator uygulamanızdaki kodu girin veya yedek
            kod kullanın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {formError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
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
              {twoFactorMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Doğrulanıyor…
                </>
              ) : (
                'Giriş yap'
              )}
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
    <>
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
            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            {isHepsiburadaQuickLoginEnabled() ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={loginMutation.isPending}
                onClick={() => {
                  const credentials = getHepsiburadaQuickLoginCredentials();
                  form.setValue('email', credentials.email);
                  form.setValue('password', credentials.password);
                  loginMutation.mutate(credentials);
                }}
              >
                Hepsiburada
              </Button>
            ) : null}
            {isDemoMode() ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Demo hesapları</p>
                  <div className="flex flex-col gap-2">
                    {DEMO_LOGIN_ACCOUNTS.filter(
                      (account) => account.slug !== 'demo-hepsiburada',
                    ).map((account) => (
                      <Button
                        key={account.slug}
                        type="button"
                        variant="outline"
                        className="h-auto w-full flex-col items-start gap-0.5 py-3 text-left"
                        disabled={loginMutation.isPending}
                        onClick={() => {
                          const credentials = {
                            email: account.email,
                            password: getDemoLoginPassword(account.email),
                          };
                          form.setValue('email', credentials.email);
                          form.setValue('password', credentials.password);
                          loginMutation.mutate(credentials);
                        }}
                      >
                        <span className="font-medium">{account.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {account.productLineHint}
                        </span>
                        <span className="text-[0.65rem] font-normal text-muted-foreground/80">
                          {account.description}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">veya</span>
                  </div>
                </div>
              </>
            ) : null}
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
                      autoFocus
                      placeholder="ornek@sirket.com"
                      className="text-base"
                      {...field}
                      onChange={(e) => {
                        setFormError(null);
                        field.onChange(e);
                      }}
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
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Şifre</FormLabel>
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Şifremi unuttum?
                    </Link>
                  </div>
                  <FormControl>
                    <PasswordInput
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="text-base"
                      {...field}
                      onChange={(e) => {
                        setFormError(null);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label
                htmlFor="remember-me"
                className="cursor-pointer text-sm font-normal leading-none"
              >
                Beni hatırla
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || !form.formState.isValid}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Giriş yapılıyor…
                </>
              ) : (
                'Giriş yap'
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hesabınız yok mu?{' '}
              <Link
                to={
                  searchParams.get('invite')
                    ? `/register?invite=${encodeURIComponent(searchParams.get('invite')!)}`
                    : '/register'
                }
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Kayıt olun
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
    {isDemoMode() ? (
      <p className="mx-auto mt-4 max-w-md text-center text-xs text-muted-foreground">
        Demo şifreleri ve org slug tablosu için kök{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          .env.example
        </code>
        ; veri için{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
          SEED_DEMO=true pnpm seed
        </code>
        .
      </p>
    ) : (
      <LoginPageProductLinesHint />
    )}
    </>
  );
}
