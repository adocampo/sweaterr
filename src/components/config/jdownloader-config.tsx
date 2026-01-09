'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Settings, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

const createSchema = (t: ReturnType<typeof useI18n>['t']) => z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('local'),
    connectionName: z.string().min(1, t('validation.connectionNameRequired')),
    localHost: z.string().min(1, t('validation.hostRequired')),
    localPort: z.number().min(1, t('validation.portRequired')),
  }),
  z.object({
    mode: z.literal('cloud'),
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(1, t('validation.passwordRequired')),
    deviceName: z.string().min(1, t('validation.deviceNameRequired')),
  }),
]);

type JDownloaderFormData = z.infer<ReturnType<typeof createSchema>>;

interface JDownloaderConfigProps {
  config?: any | null;
  onConfigSave?: (config: JDownloaderFormData) => void;
  onTestConnection?: (config: JDownloaderFormData) => Promise<boolean>;
  isAdd?: boolean;
  isEdit?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  language?: 'es' | 'en';
}

export function JDownloaderConfig({
  config,
  onConfigSave,
  onTestConnection,
  isAdd,
  isEdit,
  isOpen: externalIsOpen,
  onOpenChange,
  language = 'es',
}: JDownloaderConfigProps) {
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
  const [mode, setMode] = useState<'local' | 'cloud'>(config?.mode || 'local');

  const jdownloaderSchema = useMemo(() => createSchema(t), [t]);

  const form = useForm<JDownloaderFormData>({
    resolver: zodResolver(jdownloaderSchema),
    defaultValues: config || {
      mode: 'local',
      connectionName: '',
      localHost: '',
      localPort: 3128,
      email: '',
      password: '',
      deviceName: '',
    },
  });

  const handleTestConnection = async (values: JDownloaderFormData) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (onTestConnection) {
        const success = await onTestConnection(values);
        setTestResult(success ? 'success' : 'error');
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setTestResult('success');
      }
    } catch (error) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (values: JDownloaderFormData) => {
    if (onConfigSave) {
      onConfigSave(values);
    }
    setIsOpen(false);
    form.reset();
  };

  const handleModeChange = (newMode: 'local' | 'cloud') => {
    setMode(newMode);
    form.setValue('mode', newMode);
    form.clearErrors();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={isAdd ? 'default' : 'outline'} size={isAdd ? 'default' : 'icon'}>
          {isAdd ? (
            <>
              <Plus className="h-4 w-4 mr-2" />
              {t('jdownloaderConfig.add')}
            </>
          ) : (
            <Settings className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('jdownloaderConfig.edit') : t('jdownloaderConfig.configure')}</DialogTitle>
          <DialogDescription>
            {t('jdownloaderConfig.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="mode"
              render={() => (
                <FormItem>
                  <FormLabel>{t('jdownloaderConfig.mode')}</FormLabel>
                  <Select value={mode} onValueChange={handleModeChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">{t('jdownloaderConfig.local')}</SelectItem>
                      <SelectItem value="cloud">{t('jdownloaderConfig.cloud')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('jdownloaderConfig.modeDescription')}
                  </FormDescription>
                </FormItem>
              )}
            />

            <Separator />

            {mode === 'local' && (
              <>
                <FormField
                  control={form.control}
                  name="connectionName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('jdownloaderConfig.connectionName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.connectionNameExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('jdownloaderConfig.connectionNameDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="localHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('jdownloaderConfig.host')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.localHostExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('jdownloaderConfig.hostDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="localPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('jdownloaderConfig.port')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t('components.portExample')}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('jdownloaderConfig.portDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {mode === 'cloud' && (
              <>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('jdownloaderConfig.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('components.emailExample')} {...field} />
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
                      <FormLabel>{t('jdownloaderConfig.password')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('components.passwordExample')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('jdownloaderConfig.deviceName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('components.deviceNameExample')} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t('jdownloaderConfig.deviceNameDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleTestConnection(form.getValues())}
                disabled={isTesting}
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('jdownloaderConfig.testing')}
                  </>
                ) : (
                  <>
                    {t('jdownloaderConfig.test')}
                  </>
                )}
              </Button>

              {testResult && (
                <Badge variant={testResult === 'success' ? 'default' : 'destructive'}>
                  {testResult === 'success' ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {t('jdownloaderConfig.testSuccess')}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('jdownloaderConfig.testError')}
                    </>
                  )}
                </Badge>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">
                {isEdit ? t('jdownloaderConfig.save') : t('jdownloaderConfig.add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}