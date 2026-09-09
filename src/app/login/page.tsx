'use client';

import { Suspense, useEffect, useActionState, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/hooks/use-i18n';
import Image from 'next/image';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Footer } from '@/components/footer';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();
    const [state, login, isPending] = useActionState(loginAction, null);

    useEffect(() => {
        if (state?.success) {
            router.push('/');
        }
    }, [state, router]);

    const error = state?.error || searchParams.get('error') || '';

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="flex-1 flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center space-y-2 pb-4">
                        <div className="flex justify-center mb-2">
                            <Image src="/logo.png" alt="Sweaterr" width={200} height={50} priority className="h-12 w-auto" />
                        </div>
                        <CardTitle>{t('auth.login')}</CardTitle>
                        <CardDescription>{t('login.enterCredentials')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form action={login} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('login.usernameOrEmail')}</label>
                                <Input
                                    type="text"
                                    name="usernameOrEmail"
                                    placeholder={t('login.usernameOrEmailPlaceholder')}
                                    disabled={isPending}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('auth.password')}</label>
                                <Input
                                    type="password"
                                    name="password"
                                    placeholder="••••••••"
                                    disabled={isPending}
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.loading')}
                                    </>
                                ) : (
                                    t('auth.login')
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <Footer />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginFormWithSetupCheck />
        </Suspense>
    );
}

function LoginFormWithSetupCheck() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        fetch('/api/auth/users-count', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                // No users → redirect to setup
                if (!(data.success && data.count > 0)) {
                    router.replace('/setup');
                } else {
                    setChecking(false);
                }
            })
            .catch(() => {
                // If check fails, show login (user can still proceed)
                if (!cancelled) setChecking(false);
            });

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return <LoginForm />;
}
