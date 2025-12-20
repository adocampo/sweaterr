'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Download,
  Search,
  Globe,
  Cpu,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Activity,
  Sun,
  Moon,
  Monitor,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Edit
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { JDownloaderConfig } from '@/components/config/jdownloader-config';
import { AIConfig } from '@/components/config/ai-config';
import { ForumConfig } from '@/components/config/forum-config';
import { ArrConfig } from '@/components/config/arr-config';
import { SearchTester } from '@/components/testing/search-tester';
import { ResultViewer } from '@/components/testing/result-viewer';
import { JDownloaderTester } from '@/components/testing/jdownloader-tester';
import { DownloadsManager } from '@/components/downloads/downloads-manager';
import { useForums, useJDownloaderConfig, useAIConfig, useDownloads, useJDownloaders, useAIModels } from '@/hooks/use-api';
import { useTheme } from '@/components/theme-provider';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');

  // Testing state
  const [testingResults, setTestingResults] = useState<any[]>([]);
  const [testingForumId, setTestingForumId] = useState('');
  const [testingQuery, setTestingQuery] = useState('');

  // Edit state
  const [editingJDownloader, setEditingJDownloader] = useState<string | null>(null);
  const [editingForum, setEditingForum] = useState<string | null>(null);
  const [editingAIModel, setEditingAIModel] = useState<string | null>(null);

  const { forums, loading: forumsLoading, createForum, updateForum, deleteForum, refetch: refetchForums, testConnection: testForumConnection } = useForums();
  const { instances: jdownloaders, loading: jdLoading, createInstance: createJDownloader, deleteInstance: deleteJDownloader, toggleInstance: toggleJDownloader, refetch: refetchJDownloaders } = useJDownloaders();
  const { models: aiModels, loading: aiLoading, createModel: createAIModel, deleteModel: deleteAIModel, toggleModel: toggleAIModel, refetch: refetchAIModels } = useAIModels();
  const { downloads, loading: downloadsLoading } = useDownloads();
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const themeIcon = theme === 'system' ? <Monitor className="h-4 w-4" /> : resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const themeLabel = theme === 'system' ? 'Sistema' : resolvedTheme === 'dark' ? 'Oscuro' : 'Claro';

  const getStatusIcon = (connected: boolean) => {
    return connected ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      downloading: 'default',
      completed: 'secondary',
      pending: 'outline',
      failed: 'destructive'
    };
    return variants[status] || 'outline';
  };

  // Calculate statistics
  const stats = {
    forums: {
      total: forums.length,
      online: forums.filter(f => f.enabled).length,
      offline: forums.filter(f => !f.enabled).length
    },
    jdownloader: {
      connected: jdownloaders.length > 0,
      deviceName:
        jdownloaders[0]?.mode === 'local'
          ? `${jdownloaders[0]?.localHost ?? ''}:${jdownloaders[0]?.localPort ?? ''}`
          : jdownloaders[0]?.deviceName || 'No configurado',
      downloadsActive: downloads.filter(d => d.status === 'downloading').length,
      downloadsTotal: downloads.length
    },
    ai: {
      provider: aiModels[0]?.provider || 'No configurado',
      model: aiModels[0]?.model || 'No configurado',
      connected: aiModels.length > 0
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blazarr</h1>
          <p className="text-muted-foreground">
            Integración con foros de descarga directa para Sonarr/Radarr/Lidarr
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleTheme} className="flex items-center gap-2">
            {themeIcon}
            <span className="text-xs">Tema: {themeLabel}</span>
          </Button>
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Activo
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="forums">Foros</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="downloads">Descargas</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Forums Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Foros</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.forums.online}/{stats.forums.total}</div>
                <p className="text-xs text-muted-foreground">
                  Conectados
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(stats.forums.online > 0)}
                  <span className="text-xs">En línea</span>
                </div>
              </CardContent>
            </Card>

            {/* JDownloader Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">JDownloader</CardTitle>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.jdownloader.downloadsActive}</div>
                <p className="text-xs text-muted-foreground">
                  Descargas activas
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(stats.jdownloader.connected)}
                  <span className="text-xs">{stats.jdownloader.deviceName}</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">IA</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ai.provider}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.ai.model}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(stats.ai.connected)}
                  <span className="text-xs">Conectado</span>
                </div>
              </CardContent>
            </Card>

            {/* Total Downloads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Descargas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.jdownloader.downloadsTotal}</div>
                <p className="text-xs text-muted-foreground">
                  Histórico
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">Operativo</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Downloads */}
          <Card>
            <CardHeader>
              <CardTitle>Descargas Recientes</CardTitle>
              <CardDescription>
                Últimas descargas procesadas desde los foros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {downloadsLoading ? (
                <p>Cargando descargas...</p>
              ) : downloads.length === 0 ? (
                <p className="text-muted-foreground">No hay descargas recientes</p>
              ) : (
                <div className="space-y-4">
                  {downloads.slice(0, 5).map((download) => (
                    <div key={download.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{download.title}</h4>
                          <Badge variant={getStatusBadge(download.status)} className="text-xs">
                            {download.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Foro: {download.forumName}</span>
                          {download.size && <span>Tamaño: {download.size}</span>}
                        </div>
                        {download.status === 'downloading' && (
                          <div className="mt-2">
                            <Progress value={download.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.round(download.progress)}% completado
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forums Tab */}
        <TabsContent value="forums" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Foros Configurados</h2>
              <p className="text-muted-foreground">
                Gestiona los foros de descarga directa
              </p>
            </div>
            <ForumConfig
              onConfigSave={async (values) => {
                try {
                  await createForum(values);
                  refetchForums();
                } catch (error) {
                  console.error('Error creating forum:', error);
                }
              }}
              onTestConnection={testForumConnection}
            />
          </div>

          {forumsLoading ? (
            <p>Cargando foros...</p>
          ) : forums.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay foros configurados</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Añade tu primer foro de descarga directa para empezar a buscar contenido
                </p>
                <ForumConfig
                  onConfigSave={async (values) => {
                    try {
                      await createForum(values);
                      refetchForums();
                    } catch (error) {
                      console.error('Error creating forum:', error);
                    }
                  }}
                  onTestConnection={testForumConnection}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {forums.map((forum) => (
                <Card key={forum.id}>
                  <CardHeader>
                    <CardTitle>{forum.name}</CardTitle>
                    <CardDescription>{forum.baseUrl}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(forum.enabled)}
                          <span className="text-sm font-medium">
                            {forum.enabled ? 'Conectado' : 'Desactivado'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {forum.credentials ? 'Con credenciales' : 'Sin credenciales'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <ForumConfig
                          config={{
                            name: forum.name,
                            baseUrl: forum.baseUrl,
                            searchPath: forum.searchPath,
                            searchMode: (forum as any).searchMode,
                            cseId: (forum as any).cseId,
                            thankButtonSelector: forum.thankButtonSelector || undefined,
                            linksContainerSelector: forum.linksContainerSelector || undefined,
                            postTitleSelector: forum.postTitleSelector || undefined,
                            username: forum.credentials?.username,
                            password: forum.credentials?.password,
                          }}
                          onConfigSave={async (values) => {
                            try {
                              await updateForum(forum.id, values);
                              refetchForums();
                            } catch (error) {
                              console.error('Error updating forum:', error);
                            }
                          }}
                          onTestConnection={testForumConnection}
                          isEdit={true}
                          forumId={forum.id}
                          isOpen={editingForum === forum.id}
                          onOpenChange={(open) => setEditingForum(open ? forum.id : null)}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar foro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará permanentemente <strong>{forum.name}</strong> y todas sus credenciales.
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={async () => {
                                  try {
                                    await deleteForum(forum.id);
                                    refetchForums();
                                  } catch (error) {
                                    console.error('Error deleting forum:', error);
                                  }
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Testing y Emulación</h2>
            <p className="text-muted-foreground">
              Prueba búsquedas, extracción de enlaces y automatización de foros
            </p>
          </div>

          <div className="space-y-6">
            <SearchTester
              forums={forums}
              onSearchResults={(results, forumId, query) => {
                setTestingResults(results);
                setTestingForumId(forumId);
                setTestingQuery(query);
              }}
            />

            {testingResults.length > 0 && (
              <ResultViewer
                results={testingResults}
                forumId={testingForumId}
                searchQuery={testingQuery}
                onExtractLinks={(links, postUrl) => {
                  console.log('Extracted links:', links, 'from', postUrl);
                }}
              />
            )}

            <JDownloaderTester />
          </div>
        </TabsContent>

        {/* Downloads Tab */}
        <TabsContent value="downloads" className="space-y-6">
          <DownloadsManager />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
            <p className="text-muted-foreground">
              Configura los servicios y preferencias de la aplicación
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  JDownloader
                </CardTitle>
                <CardDescription>
                  Configura JDownloader para gestionar descargas automáticas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">JDownloader</h3>
                    <JDownloaderConfig
                      config={undefined}
                      onConfigSave={async (values) => {
                        await createJDownloader(values);
                      }}
                      onTestConnection={async (values) => {
                        const res = await fetch('/api/config/jdownloader/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(values),
                        });
                        const data = await res.json();
                        return !!data.success;
                      }}
                      isAdd={true}
                    />
                  </div>

                  <div className="space-y-2">
                    {jdLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : jdownloaders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay instancias de JDownloader configuradas.</p>
                    ) : (
                      jdownloaders.map((jd) => (
                        <div key={jd.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {jd.mode === 'local' ? (jd.connectionName || `${jd.localHost}:${jd.localPort}`) : jd.deviceName}
                              </span>
                              <Badge variant={jd.mode === 'local' ? 'secondary' : 'outline'}>
                                {jd.mode === 'local' ? 'Local' : 'Cloud'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {jd.mode === 'local' ? (jd.connectionName ? `${jd.localHost}:${jd.localPort}` : '') : jd.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={async () => {
                                await toggleJDownloader(jd.id, !jd.enabled);
                                await refetchJDownloaders();
                              }}
                            >
                              {jd.enabled ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <JDownloaderConfig
                              config={jd}
                              onConfigSave={async (values) => {
                                await fetch(`/api/config/jdownloader?id=${jd.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(values),
                                });
                                await refetchJDownloaders();
                                setEditingJDownloader(null);
                              }}
                              onTestConnection={async (values) => {
                                const res = await fetch('/api/config/jdownloader/test', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(values),
                                });
                                const data = await res.json();
                                return !!data.success;
                              }}
                              isEdit={true}
                              isOpen={editingJDownloader === jd.id}
                              onOpenChange={(open) => setEditingJDownloader(open ? jd.id : null)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar JDownloader?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará permanentemente <strong>{jd.deviceName}</strong>.
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      try {
                                        await deleteJDownloader(jd.id);
                                      } catch (error) {
                                        console.error('Error deleting JDownloader:', error);
                                      }
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Inteligencia Artificial
                </CardTitle>
                <CardDescription>
                  Configura el proveedor de IA para el mapeo de nombres
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Modelos de IA</h3>
                    <AIConfig
                      config={undefined}
                      onConfigSave={async (values) => {
                        await createAIModel(values);
                      }}
                      onTestConnection={async (values) => {
                        const res = await fetch('/api/config/ai/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(values),
                        });
                        const data = await res.json();
                        return !!data.success;
                      }}
                      isAdd={true}
                    />
                  </div>

                  <div className="space-y-2">
                    {aiLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : aiModels.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay modelos de IA configurados.</p>
                    ) : (
                      aiModels.map((ai) => (
                        <div key={ai.id} className="flex items-center justify-between border rounded-md p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{ai.provider}</Badge>
                              <span className="font-medium text-sm">{ai.model || 'Modelo por defecto'}</span>
                            </div>
                            {ai.baseUrl && (
                              <div className="text-xs text-muted-foreground truncate max-w-xs">
                                {ai.baseUrl}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => toggleAIModel(ai.id, !ai.enabled)}
                            >
                              {ai.enabled ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <AIConfig
                              config={{
                                provider: ai.provider,
                                apiKey: (ai as any).apiKey,
                                baseUrl: (ai as any).baseUrl,
                                model: ai.model,
                              }}
                              onConfigSave={async (values) => {
                                await fetch(`/api/config/ai/list/${ai.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(values),
                                });
                                await refetchAIModels();
                                setEditingAIModel(null);
                              }}
                              isEdit={true}
                              isOpen={editingAIModel === ai.id}
                              onOpenChange={(open) => setEditingAIModel(open ? ai.id : null)}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar modelo de IA?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará permanentemente la configuración de <strong>{ai.provider}</strong>.
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => {
                                      try {
                                        await deleteAIModel(ai.id);
                                      } catch (error) {
                                        console.error('Error deleting AI model:', error);
                                      }
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Servicios *arr
                </CardTitle>
                <CardDescription>
                  Gestiona claves API por servicio (Sonarr/Radarr/Lidarr/Readarr)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ArrConfig />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}