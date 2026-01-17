'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/hooks/use-i18n';
import { InfoIcon } from 'lucide-react';

interface TestingSettingsProps {
    language?: 'es' | 'en';
}

export function TestingSettings({ language = 'es' }: TestingSettingsProps) {
    const { t } = useI18n(language);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('testing.testingSettingsTitle')}</CardTitle>
                <CardDescription>
                    {t('testing.testingSettingsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                        <p className="font-medium mb-1">FlareSolverr siempre activado</p>
                        <p className="text-xs">El sistema usa FlareSolverr por defecto para resolver desafíos de Cloudflare y obtener HTML dinámico de los foros.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
