'use client';

import { useState, useEffect } from 'react';
import { Loader2, PlugZap, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/hooks/use-i18n';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type TestResponse =
    | {
        success: true;
        message: string;
    }
    | {
        success: false;
        error: string;
    };

interface JDownloaderTesterProps {
    language?: 'es' | 'en';
}

export function JDownloaderTester({ language = 'es' }: JDownloaderTesterProps) {
    const { t } = useI18n(language);
    const [servers, setServers] = useState<any[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [link, setLink] = useState('');
    const [packageName, setPackageName] = useState('');
    const [autoStart, setAutoStart] = useState(false);
    const [autoExtract, setAutoExtract] = useState(false);

    const [isTesting, setIsTesting] = useState(false);
    const [isLoadingServers, setIsLoadingServers] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<TestResponse | null>(null);

    // Load configured servers on mount
    useEffect(() => {
        const loadServers = async () => {
            try {
                const response = await fetch('/api/config/jdownloader');
                const data = await response.json();
                if (data.success && Array.isArray(data.instances)) {
                    // Filtrar solo instancias habilitadas
                    const enabledInstances = data.instances.filter((jd: any) => jd.enabled);
                    setServers(enabledInstances);
                    if (enabledInstances.length > 0) {
                        setSelectedServerId(enabledInstances[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load JDownloader servers:', err);
            } finally {
                setIsLoadingServers(false);
            }
        };
        loadServers();
    }, []);

    const runTest = async (withLink: boolean) => {
        setIsTesting(true);
        setError(null);
        setResult(null);

        try {
            const selectedServer = servers.find(s => s.id === selectedServerId);
            if (!selectedServer) {
                setError(t('testing.selectServerFirst'));
                setIsTesting(false);
                return;
            }

            // Build payload based on server mode
            const payload: any = {
                mode: selectedServer.mode,
            };

            if (selectedServer.mode === 'local') {
                payload.localHost = selectedServer.localHost;
                payload.localPort = selectedServer.localPort;
            } else if (selectedServer.mode === 'cloud') {
                payload.email = selectedServer.email;
                payload.password = selectedServer.password;
                payload.deviceName = selectedServer.deviceName;
            }

            if (withLink) {
                if (!link.trim()) {
                    setError(t('testing.sendLinkError'));
                    setIsTesting(false);
                    return;
                }
                payload.link = link.trim();
                if (packageName.trim()) payload.packageName = packageName.trim();
                payload.autostart = autoStart;
                payload.autoExtract = autoExtract;
            }

            const response = await fetch('/api/config/jdownloader/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = (await response.json()) as TestResponse;
            setResult(data);

            if (!data.success) {
                setError(data.error || t('testing.connectionTestError'));
            }
        } catch (err) {
            console.error('JDownloader test error:', err);
            setError(t('testing.connectionTestError'));
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('testing.jdownloaderTesterTitle')}</CardTitle>
                <CardDescription>
                    {t('testing.jdownloaderTesterDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoadingServers ? (
                    <p className="text-sm text-muted-foreground">{t('testing.loadingServers')}</p>
                ) : servers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('testing.noServers')}</p>
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('testing.configuredServer')}</label>
                            <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {servers.map((server) => (
                                        <SelectItem key={server.id} value={server.id}>
                                            {server.mode === 'local'
                                                ? `${server.connectionName || `${server.localHost}:${server.localPort}`} (Local)`
                                                : `${server.deviceName} (Cloud)`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('testing.optionalLink')}</label>
                            <Input
                                type="url"
                                placeholder="https://..."
                                value={link}
                                onChange={(e) => setLink(e.target.value)}
                                disabled={isTesting}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('testing.optionalPackage')}</label>
                            <Input
                                type="text"
                                placeholder="test-package"
                                value={packageName}
                                onChange={(e) => setPackageName(e.target.value)}
                                disabled={isTesting}
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="autostart"
                                    checked={autoStart}
                                    onCheckedChange={(checked) => setAutoStart(checked as boolean)}
                                    disabled={isTesting}
                                />
                                <label htmlFor="autostart" className="text-sm font-medium cursor-pointer">
                                    {t('testing.autoStart')}
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="autoextract"
                                    checked={autoExtract}
                                    onCheckedChange={(checked) => setAutoExtract(checked as boolean)}
                                    disabled={isTesting}
                                />
                                <label htmlFor="autoextract" className="text-sm font-medium cursor-pointer">
                                    {t('testing.autoExtract')}
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2">
                            <Button
                                variant="outline"
                                onClick={() => runTest(false)}
                                disabled={isTesting}
                            >
                                {isTesting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <PlugZap className="h-4 w-4 mr-2" />
                                )}
                                {t('testing.testConnection')}
                            </Button>

                            <Button
                                onClick={() => runTest(true)}
                                disabled={isTesting || !link.trim()}
                            >
                                {isTesting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4 mr-2" />
                                )}
                                {t('testing.sendLink')}
                            </Button>
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className={`border rounded-md p-3 ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
