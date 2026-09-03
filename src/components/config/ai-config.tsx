'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Settings, Loader2, Cpu, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { AIConfigForm } from '@/lib/types';
import { AI_PROVIDERS } from '@/lib/services/ai';

const createSchema = (t: ReturnType<typeof useI18n>['t']) => z.object({
  provider: z.string().min(1, 'Provider required'),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

const aiProviders = Object.entries(AI_PROVIDERS).map(([value, spec]) => ({
  value,
  label: spec.label,
  models: spec.fallbackModels,
  defaultBaseUrl: spec.defaultBaseUrl || '',
  requiresApiKey: spec.requiresApiKey,
}));

export interface AITestResult {
  success: boolean;
  error?: string;
  models?: string[];
}

interface AIConfigProps {
  config?: AIConfigForm | null;
  onConfigSave?: (config: AIConfigForm) => void;
  onTestConnection?: (config: AIConfigForm) => Promise<boolean | AITestResult>;
  isAdd?: boolean;
  isEdit?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  language?: 'es' | 'en';
}

export function AIConfig({ config, onConfigSave, onTestConnection, isAdd, isEdit, isOpen: externalIsOpen, onOpenChange, language = 'es' }: AIConfigProps) {
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
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState(config?.provider || '');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const aiSchema = useMemo(() => createSchema(t), [t]);

  const form = useForm<AIConfigForm>({
    resolver: zodResolver(aiSchema),
    defaultValues: config || {
      provider: '',
      apiKey: '',
      baseUrl: '',
      model: '',
    },
  });

  const selectedProviderData = aiProviders.find(p => p.value === selectedProvider);

  // Model ids are arbitrary on self-hosted servers, so ask the endpoint instead of guessing.
  const loadModels = async (values: AIConfigForm) => {
    if (!values.provider) return;
    setIsLoadingModels(true);
    try {
      const response = await fetch('/api/config/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: values.provider,
          apiKey: values.apiKey || undefined,
          baseUrl: values.baseUrl || undefined,
        }),
      });
      const data = await response.json();
      setAvailableModels(data?.data?.models || []);
    } catch {
      setAvailableModels(selectedProviderData?.models || []);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Populate the model list as soon as an already-configured entry is opened.
  useEffect(() => {
    if (!isOpen || !config?.provider) return;
    loadModels(form.getValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerData = aiProviders.find(p => p.value === provider);

    form.setValue('provider', provider);
    form.setValue('model', providerData?.models[0] || '');
    // Keep a hand-typed URL when the new provider is self-hosted and has no default.
    if (providerData?.defaultBaseUrl || !form.getValues('baseUrl')) {
      form.setValue('baseUrl', providerData?.defaultBaseUrl || '');
    }
    setAvailableModels(providerData?.models || []);
    setTestResult(null);
    setTestMessage(null);
  };

  const handleTestConnection = async (values: AIConfigForm) => {
    if (!onTestConnection) return;
    setIsTesting(true);
    setTestResult(null);
    setTestMessage(null);

    try {
      const outcome = await onTestConnection(values);
      const result: AITestResult = typeof outcome === 'boolean' ? { success: outcome } : outcome;
      setTestResult(result.success ? 'success' : 'error');
      setTestMessage(result.error || null);
      if (result.models?.length) {
        setAvailableModels(result.models);
      }
    } catch (error) {
      setTestResult('error');
      setTestMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (values: AIConfigForm) => {
    if (onConfigSave) {
      onConfigSave(values);
    }
    setIsOpen(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={isAdd ? 'default' : 'outline'} size={isAdd ? 'default' : 'icon'}>
          {isAdd ? (
            <>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.aiConfig')}
            </>
          ) : (
            <Settings className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('aiConfig.edit') : t('aiConfig.title')}</DialogTitle>
          <DialogDescription>
            {t('aiConfig.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('aiConfig.provider')}</FormLabel>
                  <Select onValueChange={handleProviderChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('aiConfig.providerPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {aiProviders.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('aiConfig.model')}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        placeholder={t('aiConfig.modelPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t('aiConfig.refreshModels')}
                      disabled={isLoadingModels || !selectedProvider}
                      onClick={() => loadModels(form.getValues())}
                    >
                      {isLoadingModels
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                  {(availableModels.length ? availableModels : selectedProviderData?.models || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(availableModels.length ? availableModels : selectedProviderData?.models || []).map((model) => (
                        <Button
                          key={model}
                          type="button"
                          size="sm"
                          variant={field.value === model ? 'default' : 'outline'}
                          className="h-7 px-2 text-xs font-normal"
                          onClick={() => field.onChange(model)}
                        >
                          {model}
                        </Button>
                      ))}
                    </div>
                  )}
                  <FormDescription>
                    {availableModels.length
                      ? t('aiConfig.modelsLoaded').replace('{count}', String(availableModels.length))
                      : t('aiConfig.modelsHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('aiConfig.apiKey')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t('aiConfig.apiKeyPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {selectedProviderData && !selectedProviderData.requiresApiKey
                      ? t('components.apiKeyNotRequired')
                      : t('components.apiKeyRequired')
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('aiConfig.baseUrl')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('aiConfig.baseUrlPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {selectedProvider === 'ollama'
                      ? t('components.ollama')
                      : t('components.apiBase')
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTestConnection(form.getValues())}
                  disabled={isTesting || !onTestConnection}
                  className="flex items-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('aiConfig.testing')}
                    </>
                  ) : (
                    <>
                      <Cpu className="h-4 w-4" />
                      {t('aiConfig.test')}
                    </>
                  )}
                </Button>

                {testResult && (
                  <Badge variant={testResult === 'success' ? 'default' : 'destructive'}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('aiConfig.testSuccess')}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('aiConfig.testError')}
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {testMessage && (
                <p className="text-xs text-muted-foreground break-all">{testMessage}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {t('aiConfig.cancel')}
              </Button>
              <Button type="submit">
                {isEdit ? t('aiConfig.save') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}