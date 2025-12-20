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

const forumSchema = z.object({
  name: z.string().min(1, 'El nombre del foro es requerido'),
  baseUrl: z.string().url('URL inválida'),
  searchPath: z.string().optional(),
  searchMode: z.enum(['native', 'google_site', 'google_cse']).optional(),
  cseId: z.string().optional(),
  thankButtonSelector: z.string().optional(),
  linksContainerSelector: z.string().optional(),
  postTitleSelector: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
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
}

const defaultSelectors = {
  descargasdd: {
    thankButtonSelector: '.thank-button, button[title*="thank"], .thanks-btn',
    linksContainerSelector: '.post-content, .message-body, .post-body',
    postTitleSelector: '.post-title, .topic-title, h1, h2',
    searchPath: '/search.php'
  }
};

export function ForumConfig({ config, onConfigSave, onTestConnection, isEdit = false, forumId, isOpen: externalIsOpen, onOpenChange }: ForumConfigProps) {
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
      cseId: '',
      thankButtonSelector: '',
      linksContainerSelector: '',
      postTitleSelector: '',
      username: '',
      password: '',
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
      setTestMessage('Nombre y URL base son requeridos');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      if (onTestConnection) {
        const success = await onTestConnection(values);
        setTestResult(success ? 'success' : 'error');
        setTestMessage(success ? 'Conexión exitosa' : 'Error al conectar con el foro');
      } else {
        setTestResult('error');
        setTestMessage('No hay función de test configurada');
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Error desconocido');
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
            Añadir Foro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Foro' : 'Añadir Nuevo Foro'}
          </DialogTitle>
          <DialogDescription>
            Configura un foro de descarga directa para buscar contenido
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
                    <FormLabel>Nombre del Foro</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DescargasDD"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre descriptivo del foro
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
                    <FormLabel>URL Base</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://descargasdd.org"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      URL principal del foro
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
                  <FormLabel>Modo de Búsqueda</FormLabel>
                  <FormControl>
                    <select className="w-full border rounded-md h-9 px-2" {...field}>
                      <option value="native">Nativo</option>
                      <option value="google_site">Google (site:)</option>
                      <option value="google_cse">Google CSE (cx)</option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    Usa Google (site:) si el foro redirige a un buscador externo
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
                    <FormLabel>Google CSE ID (cx)</FormLabel>
                    <FormControl>
                      <Input placeholder="44f04a516a5b84434" {...field} />
                    </FormControl>
                    <FormDescription>
                      Identificador de tu motor CSE si el foro usa Google CSE
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {form.watch('searchMode') === 'native' && (
              <FormField
                control={form.control}
                name="searchPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ruta de Búsqueda</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="/search.php"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Path para la búsqueda de contenido (solo para modo nativo)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={useCredentials}
                  onCheckedChange={setUseCredentials}
                />
                <label className="text-sm font-medium">
                  Requiere autenticación
                </label>
              </div>

              {useCredentials && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-muted">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuario</FormLabel>
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
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
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
              <h4 className="text-sm font-medium">Selectores CSS (Opcional)</h4>
              <p className="text-xs text-muted-foreground">
                Selectores personalizados para parsear el contenido del foro
              </p>

              <FormField
                control={form.control}
                name="thankButtonSelector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Botón de Gracias</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".thank-button, button[title*='thank']"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Selector CSS para el botón de "Gracias"
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
                    <FormLabel>Contenedor de Enlaces</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".post-content, .message-body"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Selector CSS para el contenedor de enlaces
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
                    <FormLabel>Título del Post</FormLabel>
                    <FormControl>
                      <Input
                        placeholder=".post-title, .topic-title, h1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Selector CSS para el título del post
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
                      Probando...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      Probar Conexión
                    </>
                  )}
                </Button>

                {testResult && (
                  <Badge variant={testResult === 'success' ? 'default' : 'destructive'}>
                    {testResult === 'success' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conectado
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Error
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {isEdit ? 'Actualizar' : 'Añadir'} Foro
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}