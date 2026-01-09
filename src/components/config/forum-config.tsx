'use client';

import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Settings, CheckCircle, XCircle, Loader2, Globe, Plus } from 'lucide-react';
import { ForumConfigForm } from '@/lib/types';
import { useI18n } from '@/hooks/use-i18n';

const forumSchema = z.object({
  name: z.string().min(1, 'El nombre del foro es requerido'),
  baseUrl: z.string().url('URL inválida'),
  searchPath: z.string().optional(),
  searchMode: z.enum(['native', 'google_site', 'google_cse']).optional(),
  searchForumLabel: z.string().optional(),
  cseId: z.string().optional(),
  thankButtonSelector: z.string().optional(),
  linksContainerSelector: z.string().optional(),
  postTitleSelector: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  flaresolverrSessionTTL: z.number().min(5).max(1440).optional().default(30),
}).refine(
  (data) => {
    if (data.searchMode === 'native' && !data.searchPath) {
      return false;
    }
    return true;
  },
  {
    message: 'La ruta de búsqueda es requerida para el modo nativo',
    path: ['searchPath'],
  }
);

interface ForumConfigProps {
  config?: ForumConfigForm | null;
  onConfigSave?: (config: ForumConfigForm) => void;
  onTestConnection?: (config: ForumConfigForm) => Promise<boolean>;
  isEdit?: boolean;
  forumId?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  language?: 'es' | 'en';
}

const defaultSelectors = {
  descargasdd: {
    thankButtonSelector: '.thank-button, button[title*="thank"], .thanks-btn',
    linksContainerSelector: '.post-content, .message-body, .post-body',
    postTitleSelector: '.post-title, .topic-title, h1, h2',
    searchPath: '/search.php'
  }
};

export function ForumConfig({ config, onConfigSave, onTestConnection, isEdit = false, forumId, isOpen: externalIsOpen, onOpenChange, language: propLanguage }: ForumConfigProps) {
  const { t } = useI18n(propLanguage || 'es');
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
  const [testMessage, setTestMessage] = useState<string>('');
  const [useCredentials, setUseCredentials] = useState(!!config?.username);

  const form = useForm<ForumConfigForm>({
    resolver: zodResolver(forumSchema),
    defaultValues: config || {
      name: '',
      baseUrl: '',
      searchPath: '/search.php',
      searchMode: 'native',
      searchForumLabel: '',
      cseId: '',
      thankButtonSelector: '',
      linksContainerSelector: '',
      postTitleSelector: '',
      username: '',
      password: '',
      flaresolverrSessionTTL: 30,
    },
  });

  const handleNameChange = (name: string) => {
    form.setValue('name', name);

    // Auto-fill selectors for known forums
    const forumKey = name.toLowerCase();
    if (forumKey.includes('descargasdd') || forumKey.includes('dd')) {
      const selectors = defaultSelectors.descargasdd;
      form.setValue('thankButtonSelector', selectors.thankButtonSelector);
      form.setValue('linksContainerSelector', selectors.linksContainerSelector);
      form.setValue('postTitleSelector', selectors.postTitleSelector);
      form.setValue('searchPath', selectors.searchPath);
      form.setValue('searchMode', 'google_site');
    }
  };

  const handleTestConnection = async () => {
    const values = form.getValues();

    // Validate required fields
    if (!values.name || !values.baseUrl) {
      setTestResult('error');
      setTestMessage(t('forumForm.missingNameOrUrl'));
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      if (onTestConnection) {
        const result = await onTestConnection(values);

        // Handle both old format (boolean) and new format (object)
        if (typeof result === 'boolean') {
          setTestResult(result ? 'success' : 'error');
          setTestMessage(result ? t('forums.connectionSuccessful') : t('forums.connectionFailed'));
        } else if (result && typeof result === 'object') {
          setTestResult(result.success ? 'success' : 'error');
          setTestMessage(result.message || (result.success ? t('forums.connectionSuccessful') : t('forums.connectionFailed')));
        }
      } else {
        setTestResult('error');
        setTestMessage(t('forumForm.testNotConfigured'));
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || t('forumForm.unknownError'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (values: ForumConfigForm) => {
    if (onConfigSave) {
      onConfigSave(values);
    }
    setIsOpen(false);
  };

  const handleClearCookies = async () => {
    if (!forumId) {
      setTestResult('error');
      setTestMessage('ID del foro no disponible');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      const response = await fetch(`/api/config/forums/${forumId}/refresh-cookies`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTestResult('success');
        setTestMessage(t('forumForm.clearCookiesSuccess'));
      } else {
        const data = await response.json();
        setTestResult('error');
        setTestMessage(data.error || t('forumForm.clearCookiesError'));
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || t('forumForm.unknownError'));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('forums.addForum')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('forums.editForum') : t('forums.addForum')}
          </DialogTitle>
          <DialogDescription>
            {t('forums.configureDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forums.forumName')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('components.forumNameExample')}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('forums.forumNameDescription')}
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
                    <FormLabel>{t('forums.baseUrl')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://descargasdd.org"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('forumForm.baseUrlDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="searchMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('forums.searchMode')}</FormLabel>
                  <FormControl>
                    <select className="w-full border rounded-md h-9 px-2" {...field}>
                      <option value="native">{t('forumForm.searchModeNative')}</option>
                      <option value="google_site">{t('forumForm.searchModeGoogleSite')}</option>
                      <option value="google_cse">{t('forumForm.searchModeGoogleCse')}</option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    {t('forumForm.searchModeDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('searchMode') === 'google_cse' && (
              <FormField
                control={form.control}
                name="cseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forumForm.cseId')}</FormLabel>
                    <FormControl>
                      <Input placeholder="44f04a516a5b84434" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('forumForm.cseIdDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch('searchMode') === 'native' && (
              <>
                <FormField
                  control={form.control}
                  name="searchPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('forumForm.searchPath')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="/search.php?search_type=1"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('forumForm.searchPathDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="searchForumLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('forums.searchForumLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.searchForumExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('forumForm.searchForumLabelDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="flaresolverrSessionTTL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('forumForm.sessionDurationLabel')}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        min="5"
                        max="1440"
                        step="1"
                        placeholder="30"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 30)}
                        className="flex-1"
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground min-w-fit">
                      {field.value && field.value >= 60 && field.value % 60 === 0
                        ? `${Math.floor(field.value / 60)} ${t('forums.sessionDurationHours')}`
                        : `${field.value || 30} ${t('forums.sessionDurationMinutes')}`}
                    </span>
                  </div>
                  <FormDescription>
                    {t('forums.sessionDurationDescription')}
                  </FormDescription>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 {t('forums.sessionDurationHint')}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={useCredentials}
                  onCheckedChange={setUseCredentials}
                />
                <label className="text-sm font-medium">
                  {t('forums.requiresAuth')}
                </label>
              </div>

              {useCredentials && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-muted">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('forumForm.username')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="tu_usuario"
                            {...field}
                          />
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
                        <FormLabel>{t('forumForm.password')}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={t('components.passwordExample')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">{t('forumForm.cssSelectors')}</h4>
              <p className="text-xs text-muted-foreground">
                {t('forumForm.cssSelectorsDescription')}
              </p>

              <FormField
                control={form.control}
                name="thankButtonSelector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forumForm.thankButton')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".thank-button, button[title*='thank']"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('forumForm.thankButtonDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linksContainerSelector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forumForm.linksContainer')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".post-content, .message-body"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('forumForm.linksContainerDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postTitleSelector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('forumForm.postTitle')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".post-title, .topic-title, h1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('forumForm.postTitleDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-2"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      {t('forums.testConnection')}
                    </>
                  )}
                </Button>

                {testResult && (
                  <Badge variant={testResult === 'success' ? 'default' : 'destructive'}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('forums.connectionSuccessful')}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('common.error')}
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {testMessage && (
                <p className={`text-sm ${testResult === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {testMessage}
                </p>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearCookies}
                disabled={!isEdit || isTesting}
                className="text-xs"
              >
                {isTesting && testResult === null ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t('forumForm.clearingCookies')}
                  </>
                ) : (
                  t('forumForm.clearCookies')
                )}
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">
                {isEdit ? t('common.save') : t('forums.addForum')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}