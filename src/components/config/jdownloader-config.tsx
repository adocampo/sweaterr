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

// Modo Local: IP/Hostname + Puerto
const localModeSchema = z.object({
  mode: z.literal('local'),
  connectionName: z.string().min(1, 'Nombre de conexión requerido'),
  localHost: z.string().min(1, 'Host/IP requerido'),
  localPort: z.number().min(1, 'Puerto requerido'),
});

// Modo Cloud: Email + Password + Device Name
const cloudModeSchema = z.object({
  mode: z.literal('cloud'),
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
  deviceName: z.string().min(1, 'Nombre de dispositivo requerido'),
});

const jdownloaderSchema = z.discriminatedUnion('mode', [
  localModeSchema,
  cloudModeSchema,
]);

type JDownloaderFormData = z.infer<typeof jdownloaderSchema>;

interface JDownloaderConfigProps {
  config?: any | null;
  onConfigSave?: (config: JDownloaderFormData) => void;
  onTestConnection?: (config: JDownloaderFormData) => Promise<boolean>;
  isAdd?: boolean;
  isEdit?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function JDownloaderConfig({
  config,
  onConfigSave,
  onTestConnection,
  isAdd,
  isEdit,
  isOpen: externalIsOpen,
  onOpenChange,
}: JDownloaderConfigProps) {
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
              Añadir JDownloader
            </>
          ) : (
            <Settings className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar' : 'Configurar'} JDownloader</DialogTitle>
          <DialogDescription>
            Elige entre conexión local (API Deprecated) o cloud (MyJDownloader)
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            {/* Mode selector */}
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modo de Conexión</FormLabel>
                  <Select value={mode} onValueChange={handleModeChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">Modo Local</SelectItem>
                      <SelectItem value="cloud">Modo Cloud</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Local: conecta directamente a tu JD2 vía LAN. Cloud: usa MyJDownloader para acceso remoto
                  </FormDescription>
                </FormItem>
              )}
            />

            <Separator />

            {/* Local mode fields */}
            {mode === 'local' && (
              <>
                <FormField
                  control={form.control}
                  name="connectionName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Conexión</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.connectionNameExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Nombre descriptivo para identificar esta conexión
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
                      <FormLabel>Host / IP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.localHostExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        IP o hostname de tu servidor JDownloader
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
                      <FormLabel>Puerto</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t('components.portExample')}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Puerto expuesto del servicio RemoteAPI (normalmente 3128)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Cloud mode fields */}
            {mode === 'cloud' && (
              <>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t('components.emailExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Email de tu cuenta My JDownloader
                      </FormDescription>
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
                          placeholder={t('components.passwordExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Contraseña de tu cuenta My JDownloader
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Dispositivo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('components.deviceNameExample')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Nombre del dispositivo en My JDownloader
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
                    Probando...
                  </>
                ) : (
                  <>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {isEdit ? 'Actualizar' : 'Guardar'} Configuración
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}