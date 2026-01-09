'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

interface SessionInfo {
    sessionId: string;
    ageSeconds: number;
    expiresInSeconds: number;
    isExpired: boolean;
}

interface ForumSessionData {
    forumId: string;
    forumName: string;
    ttlMs: number;
    ttlMinutes: number;
    session: SessionInfo | null;
}

interface ForumSessionSettingsProps {
    forumId: string;
    forumName: string;
}

export function ForumSessionSettings({ forumId, forumName }: ForumSessionSettingsProps) {
    const [data, setData] = useState<ForumSessionData | null>(null);
    const [ttlMinutes, setTtlMinutes] = useState<number>(30);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { t } = useI18n('es');

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/config/forums/${forumId}/session`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            if (json.success && json.data) {
                setData(json.data);
                setTtlMinutes(json.data.ttlMinutes);
            }
        } catch (err) {
            console.error('Error fetching session:', err);
            setError('Error al obtener información de sesión');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Refresh every 10 seconds
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [forumId]);

    const handleUpdateTTL = async () => {
        setUpdating(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`/api/config/forums/${forumId}/session`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ttlMinutes }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to update TTL');
            }

            setSuccess('Configuración actualizada correctamente');
            setTimeout(() => setSuccess(null), 3000);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Error al actualizar');
        } finally {
            setUpdating(false);
        }
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (minutes < 60) return `${minutes}m ${secs}s`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('testing.loadingSession')}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('forum.sessionSettings')}</CardTitle>
                <CardDescription>
                    {t('forum.manageSession')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Estado actual de sesión */}
                {data?.session ? (
                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                                <span className="font-medium text-green-900 dark:text-green-100">
                                    {t('forum.sessionActive')}
                                </span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                                {data.session.sessionId.substring(0, 8)}...
                            </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                            <div>
                                <strong>{t('forum.age')}:</strong> {formatTime(data.session.ageSeconds)}
                            </div>
                            <div>
                                <strong>{t('forum.expiresIn')}:</strong>{' '}
                                <span
                                    className={
                                        data.session.expiresInSeconds < 300
                                            ? 'text-amber-600 font-semibold'
                                            : ''
                                    }
                                >
                                    {formatTime(data.session.expiresInSeconds)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-950">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                {t('forum.noActiveSession')}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('components.automaticallySaved')}
                        </p>
                    </div>
                )}

                {/* Configuración de TTL */}
                <div className="space-y-3">
                    <Label htmlFor="ttl-{forumId}">{t('components.sessionDuration')}</Label>
                    <div className="flex gap-2">
                        <Input
                            id={`ttl-${forumId}`}
                            type="number"
                            min={1}
                            max={1440}
                            value={ttlMinutes}
                            onChange={(e) => setTtlMinutes(parseInt(e.target.value) || 30)}
                            className="w-32"
                            disabled={updating}
                        />
                        <Button
                            onClick={handleUpdateTTL}
                            disabled={updating || ttlMinutes === data?.ttlMinutes}
                        >
                            {updating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {t('components.saving')}
                                </>
                            ) : (
                                t('components.save')
                            )}
                        </Button>
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                    {success && <p className="text-sm text-green-600">{success}</p>}

                    <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                            💡 {t('components.recommendations')}:
                        </p>
                        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4">
                            <li>
                                <strong>5-10 {t('forums.sessionDurationMinutes')}:</strong> {t('components.sporadic')}
                            </li>
                            <li>
                                <strong>30 {t('forums.sessionDurationMinutes')}:</strong> {t('components.moderate')}
                            </li>
                            <li>
                                <strong>1-2 {t('forums.sessionDurationHours')}:</strong> {t('components.intensive')}
                            </li>
                            <li>
                                <strong>8-24 {t('forums.sessionDurationHours')}:</strong> {t('components.maxReusable')}
                            </li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
