'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Footer } from '@/components/footer';
import { useI18n } from '@/hooks/use-i18n';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { t } = useI18n('es');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernameOrEmail, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || 'Login failed');
                setIsLoading(false);
                return;
            }

            console.log('[Login] Success, redirecting to dashboard');

            // Force full page reload to ensure middleware picks up cookie
            window.location.href = '/';
        } catch (err) {
            setError(t('errors.tryAgain'));
            console.error('[Login] Error:', err);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-2">
                    <div className="flex justify-center mb-2">
                        <Image src="/logo.png" alt="Sweaterr" width={200} height={50} priority className="h-12 w-auto" />
                    </div>
                    <CardTitle>{t('auth.login')}</CardTitle>
                    <CardDescription>{t('login.enterCredentials')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
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
                                placeholder={t('login.usernameOrEmailPlaceholder')}
                                value={usernameOrEmail}
                                onChange={(e) => setUsernameOrEmail(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('auth.password')}</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
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
            <Footer />
        </div>
    );
}
