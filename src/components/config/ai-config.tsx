'use client';

import { useState, useMemo } from 'react';
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
import { Plus, Settings, Loader2, Cpu, CheckCircle, XCircle } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { AIConfigForm } from '@/lib/types';

const createSchema = (t: ReturnType<typeof useI18n>['t']) => z.object({
  provider: z.string().min(1, 'Provider required'),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

const aiProviders = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'deepseek', label: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  { value: 'perplexity', label: 'Perplexity', models: ['llama-3-sonar-small-32k', 'mixtral-8x7b'] },
  { value: 'ollama', label: 'Ollama', models: ['llama2', 'codellama', 'mistral', 'custom'] },
];

interface AIConfigProps {
  config?: AIConfigForm | null;
  onConfigSave?: (config: AIConfigForm) => void;
  onTestConnection?: (config: AIConfigForm) => Promise<boolean>;
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
  const [selectedProvider, setSelectedProvider] = useState(config?.provider || '');

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

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    const providerData = aiProviders.find(p => p.value === provider);

    // Reset and set default model
    form.setValue('provider', provider);
    if (providerData && providerData.models.length > 0) {
      form.setValue('model', providerData.models[0]);
    }

    // Set default base URL for Ollama
    if (provider === 'ollama') {
      form.setValue('baseUrl', 'http://localhost:11434');
    } else {
      form.setValue('baseUrl', '');
    }
  };

  const handleTestConnection = async (values: AIConfigForm) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (onTestConnection) {
        const success = await onTestConnection(values);
        setTestResult(success ? 'success' : 'error');
      } else {
        // Simulate connection test
        await new Promise(resolve => setTimeout(resolve, 2000));
        setTestResult('success');
      }
    } catch (error) {
      setTestResult('error');
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('aiConfig.modelPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectedProviderData?.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
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
                    {selectedProvider === 'ollama'
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