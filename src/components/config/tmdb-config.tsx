'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { CheckCircle, KeyRound, Loader2, Plus, Settings, XCircle } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

export interface TmdbSettingsForm {
  apiKey: string;
  enabled: boolean;
}

interface TmdbConfigProps {
  config?: { apiKey?: string | null; enabled?: boolean; source?: 'database' | 'env' | 'none' } | null;
  onConfigSave: (values: TmdbSettingsForm) => Promise<void> | void;
  onTestConnection: (values: TmdbSettingsForm) => Promise<boolean>;
  isAdd?: boolean;
  isAddDisabled?: boolean;
  isEdit?: boolean;
  language?: 'es' | 'en';
}

export function TmdbConfig({ config, onConfigSave, onTestConnection, isAdd, isAddDisabled = false, isEdit, language = 'es' }: TmdbConfigProps) {
  const { t } = useI18n(language);
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const form = useForm<TmdbSettingsForm>({
    resolver: zodResolver(z.object({
      apiKey: z.string().trim().min(1, t('tmdbConfig.apiKeyRequired')),
      enabled: z.boolean(),
    })),
    defaultValues: { apiKey: config?.apiKey || '', enabled: config?.enabled ?? true },
  });

  const handleSave = async (values: TmdbSettingsForm) => {
    await onConfigSave(values);
    setIsOpen(false);
  };

  const handleTest = async () => {
    const isValid = await form.trigger('apiKey');
    if (!isValid) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      setTestResult(await onTestConnection(form.getValues()) ? 'success' : 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={isAdd ? 'default' : 'outline'} size={isAdd ? 'default' : 'icon'} disabled={isAddDisabled}>
          {isAdd ? <><Plus className="mr-2 h-4 w-4" />{t('tmdbConfig.add')}</> : <Settings className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('tmdbConfig.edit') : t('tmdbConfig.configure')}</DialogTitle>
          <DialogDescription>{t('tmdbConfig.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField control={form.control} name="apiKey" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('tmdbConfig.apiKey')}</FormLabel>
                <FormControl><Input type="password" autoComplete="off" {...field} /></FormControl>
                <FormDescription>{t('tmdbConfig.apiKeyDescription')}</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="enabled" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5"><FormLabel>{t('tmdbConfig.useTmdb')}</FormLabel><FormDescription>{t('tmdbConfig.useTmdbDescription')}</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-sm">
              <div className="flex items-center gap-2">
                {testResult === 'success' ? <CheckCircle className="h-4 w-4 text-green-500" /> : testResult === 'error' ? <XCircle className="h-4 w-4 text-red-500" /> : <KeyRound className="h-4 w-4 text-muted-foreground" />}
                <span>{testResult === 'success' ? t('tmdbConfig.testSuccess') : testResult === 'error' ? t('tmdbConfig.testError') : t('tmdbConfig.test')}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isTesting ? t('tmdbConfig.testing') : t('tmdbConfig.test')}
              </Button>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{t('tmdbConfig.cancel')}</Button><Button type="submit">{t('tmdbConfig.save')}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
