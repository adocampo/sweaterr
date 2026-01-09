'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTestingSettings } from '@/hooks/use-api';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

interface TestingSettingsProps {
    language?: 'es' | 'en';
}

export function TestingSettings({ language = 'es' }: TestingSettingsProps) {
    const { t } = useI18n(language);
    const { bypassAxios, loading, updateSettings } = useTestingSettings();
    const [localBypassAxios, setLocalBypassAxios] = useState(bypassAxios);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalBypassAxios(bypassAxios);
    }, [bypassAxios]);

    const handleToggle = async (value: boolean) => {
        setLocalBypassAxios(value);
        setIsSaving(true);

        try {
            await updateSettings(value);
        } catch (err) {
            console.error('Error updating setting:', err);
            setLocalBypassAxios(bypassAxios); // Revert on error
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('common.loading')}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('testing.testingSettingsTitle')}</CardTitle>
                <CardDescription>
                    {t('testing.testingSettingsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                        <div className="font-medium">{t('testing.directMode')}</div>
                        <div className="text-sm text-muted-foreground">
                            {t('testing.directModeDescription')}
                        </div>
                    </div>
                    <Switch
                        checked={localBypassAxios}
                        onCheckedChange={handleToggle}
                        disabled={isSaving}
                        className="ml-4"
                    />
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="text-sm text-amber-900 dark:text-amber-100">
                        {t('testing.directModeNote')}
                    </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                        {t('testing.directModeTip')}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
