'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Plus, Settings, CheckCircle, XCircle, PlugZap } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

const flaresolverrSchema = (t: ReturnType<typeof useI18n>['t']) => z.object({
  url: z.string().trim().url(t('validation.invalidURL')).refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: t('flaresolverrConfig.urlProtocol'),
  }),
  timeout: z.coerce.number().int().min(5000).max(180000),
  enabled: z.boolean().default(true),
});

export interface FlareSolverrSettingsForm {
  url: string;
  timeout: number;
  enabled: boolean;
}

interface FlareSolverrConfigProps {
  config?: { url?: string | null; timeout?: number; enabled?: boolean; source?: 'database' | 'env' | 'none' } | null;
  onConfigSave?: (values: FlareSolverrSettingsForm) => Promise<void> | void;
  onTestConnection?: (values: FlareSolverrSettingsForm) => Promise<boolean>;
  isAdd?: boolean;
  isEdit?: boolean;
  isAddDisabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  language?: 'es' | 'en';
}

export function FlareSolverrConfig({
  config,
  onConfigSave,
  onTestConnection,
  isAdd,
  isEdit,
  isAddDisabled = false,
  isOpen: externalIsOpen,
  onOpenChange,
  language = 'es',
}: FlareSolverrConfigProps) {
  const { t } = useI18n(language);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (externalIsOpen !== undefined && onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const form = useForm<FlareSolverrSettingsForm>({
    resolver: zodResolver(flaresolverrSchema(t)),
    defaultValues: {
      url: config?.url || 'http://192.168.1.100:8191',
      timeout: config?.timeout || 60000,
      enabled: config?.enabled ?? true,
    },
  });

  const sourceBadge = useMemo(() => {
    if (!config) return null;
    if (config.source === 'database') return 'BD';
    if (config.source === 'env') return 'ENV';
    return 'OFF';
  }, [config]);

  const handleSave = async (values: FlareSolverrSettingsForm) => {
    if (onConfigSave) {
      await onConfigSave(values);
    }
    setIsOpen(false);
  };

  const handleTest = async () => {
    const values = form.getValues();
    setIsTesting(true);
    setTestResult(null);
    try {
      if (onTestConnection) {
        const success = await onTestConnection(values);
        setTestResult(success ? 'success' : 'error');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={isAdd ? 'default' : 'outline'} size={isAdd ? 'default' : 'icon'} disabled={isAddDisabled}>
          {isAdd ? (
            <>
              <Plus className="h-4 w-4 mr-2" />
              {t('flaresolverrConfig.add')}
            </>
          ) : (
            <Settings className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('flaresolverrConfig.edit') : t('flaresolverrConfig.configure')}</DialogTitle>
          <DialogDescription>
            {t('flaresolverrConfig.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('flaresolverrConfig.url')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('flaresolverrConfig.urlPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('flaresolverrConfig.urlDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('flaresolverrConfig.timeout')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={5000} max={180000} placeholder={t('flaresolverrConfig.timeoutPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('flaresolverrConfig.timeoutDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t('flaresolverrConfig.useBypass')}</FormLabel>
                    <FormDescription>{t('flaresolverrConfig.useBypassDescription')}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {sourceBadge && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('flaresolverrConfig.source')}:</span>
                <Badge variant="secondary">{sourceBadge}</Badge>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-sm">
              <div className="flex items-center gap-2">
                {testResult === 'success' ? <CheckCircle className="h-4 w-4 text-green-500" /> : testResult === 'error' ? <XCircle className="h-4 w-4 text-red-500" /> : <PlugZap className="h-4 w-4 text-muted-foreground" />}
                <span>{testResult === 'success' ? t('flaresolverrConfig.testSuccess') : testResult === 'error' ? t('flaresolverrConfig.testError') : t('flaresolverrConfig.test')}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
                {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isTesting ? t('flaresolverrConfig.testing') : t('flaresolverrConfig.test')}
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {t('flaresolverrConfig.cancel')}
              </Button>
              <Button type="submit">
                {t('flaresolverrConfig.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
