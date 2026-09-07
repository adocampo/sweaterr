'use client';

import { Suspense, useEffect, useActionState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import { useI18n } from '@/hooks/use-i18n';
import Image from 'next/image';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n('es');
    const [state, login, isPending] = useActionState(loginAction, null);

    useEffect(() => {
        if (state?.success) {
            router.push('/');
        }
    }, [state, router]);

    const error = searchParams.get('error') || '';

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
                    <div className="text-center mb-6">
                        <div className="flex justify-center mb-4">
                            <Image src="/logo.png" alt="Sweaterr" width={200} height={50} priority className="h-12 w-auto" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">{t('auth.login')}</h1>
                        <p className="text-gray-300 text-sm mt-1">{t('login.enterCredentials')}</p>
                    </div>

                    <form action={login} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">{t('login.usernameOrEmail')}</label>
                            <input
                                type="text"
                                name="usernameOrEmail"
                                placeholder={t('login.usernameOrEmailPlaceholder')}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">{t('auth.password')}</label>
                            <input
                                type="password"
                                name="password"
                                placeholder="••••••••"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded transition-colors"
                        >
                            {isPending ? '...' : t('auth.login')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
