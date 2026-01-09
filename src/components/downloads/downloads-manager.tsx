'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/hooks/use-i18n';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  ExternalLink,
  Save,
  Hammer,
  StopCircle,
  Info,
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
import { useToast } from '@/hooks/use-toast';

interface JDDownload {
  linkId: number;
  uuid: string;
  packageId?: number;
  name: string;
  host: string;
  size: number;
  status: string;
  progress: number;
  speed: number;
  eta: number;
  source: 'linkgrabber' | 'downloads';
  url?: string;
  saveTo?: string;
  addedAt?: number;
  finishedAt?: number;
  category?: string;
}

export function DownloadsManager() {
  const { t } = useI18n('es');
  const [downloads, setDownloads] = useState<JDDownload[]>([]);
  const [filteredDownloads, setFilteredDownloads] = useState<JDDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selected, setSelected] = useState<JDDownload | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDownloads = async () => {
    try {
      const response = await fetch('/api/downloads/status');
      const data = await response.json();
      if (data.success && data.data) {
        setDownloads(data.data);
      }
    } catch (error) {
      console.error('Error fetching downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
    if (autoRefresh) {
      // Refresh faster (1s) if there are active downloads, slower (5s) otherwise
      const hasActive = downloads.some((d) => {
        const status = d.status.toLowerCase();
        return status === 'running' || status === 'downloading' || status === 'extracting';
      });
      const interval = setInterval(fetchDownloads, hasActive ? 1000 : 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, downloads]);

  // Only update pathInput if user is NOT currently editing
  useEffect(() => {
    if (!isEditingPath) {
      setPathInput(selected?.saveTo ?? '');
    }
  }, [selected, isEditingPath]);

  useEffect(() => {
    if (!selected) return;
    const updated = downloads.find((d) => d.uuid === selected.uuid);
    if (updated && updated !== selected) {
      setSelected(updated);
    }
  }, [downloads, selected]);

  useEffect(() => {
    let filtered = downloads;
    if (searchQuery) {
      filtered = filtered.filter((d) =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.host.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => {
        const status = d.status.toLowerCase();
        switch (statusFilter) {
          case 'downloading':
            return status === 'running' || status === 'downloading' || status === 'extracting';
          case 'completed':
            return status === 'finished' || status === 'completed';
          case 'pending':
            return status === 'pending' || status === 'queued';
          case 'failed':
            return status === 'failed' || status === 'error';
          default:
            return true;
        }
      });
    }
    setFilteredDownloads(filtered);
  }, [downloads, searchQuery, statusFilter]);

  const formatSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond) return '0 KB/s';
    const mbps = bytesPerSecond / (1024 * 1024);
    if (mbps >= 1) return `${mbps.toFixed(2)} MB/s`;
    const kbps = bytesPerSecond / 1024;
    return `${kbps.toFixed(2)} KB/s`;
  };

  const formatETA = (seconds: number) => {
    if (!seconds || seconds < 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const date = new Date(ms);
    return date.toLocaleString();
  };

  const performAction = async (
    endpoint: string,
    body: Record<string, any>,
    key: string,
    successMessage: string
  ) => {
    try {
      setActionLoading(key);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Acción fallida');
      }
      toast({ title: successMessage });
      await fetchDownloads();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo completar la acción',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = (download: JDDownload) =>
    performAction('/api/downloads/pause', { id: download.linkId, source: download.source }, `pause-${download.uuid}`, 'Descarga pausada');

  const handleResume = (download: JDDownload) =>
    performAction(
      '/api/downloads/resume',
      { id: download.linkId, source: download.source, packageId: download.packageId },
      `resume-${download.uuid}`,
      download.source === 'linkgrabber' ? 'Descarga iniciada' : 'Descarga reanudada'
    );

  const handleStop = (download: JDDownload, removeFiles = false) =>
    performAction(
      '/api/downloads/stop',
      { id: download.linkId, source: download.source, removeFiles, packageId: download.packageId },
      `stop-${download.uuid}-${removeFiles ? 'files' : 'queue'}`,
      removeFiles ? 'Descarga eliminada y archivos borrados' : 'Descarga eliminada de la cola'
    );

  const handleExtract = (download: JDDownload) => {
    const statusLower = download.status.toLowerCase();
    const isRunning = statusLower === 'running' || statusLower === 'downloading' || statusLower === 'extracting';
    if (isRunning) {
      return performAction('/api/downloads/extract-after', { id: download.linkId, packageId: download.packageId }, `extract-after-${download.uuid}`, 'Se extraerá al finalizar');
    }
    return performAction('/api/downloads/extract', { id: download.linkId, packageId: download.packageId }, `extract-${download.uuid}`, 'Extracción forzada');
  };

  const handleSetPath = () => {
    if (!selected) return;
    if (!pathInput.trim()) {
      toast({ title: 'Ruta requerida', description: 'Introduce una ruta de descarga válida', variant: 'destructive' });
      return;
    }
    setIsEditingPath(false); // Reset editing flag after setting path
    // Optimistic UI update: reflect new path immediately in selection and list
    setSelected((prev) => (prev ? { ...prev, saveTo: pathInput } : prev));
    setDownloads((prev) => prev.map((d) => (selected && d.uuid === selected.uuid ? { ...d, saveTo: pathInput } : d)));

    console.log('[UI] Setting path for:', {
      linkId: selected.linkId,
      path: pathInput,
      packageId: selected.packageId,
      source: selected.source,
      selected: selected
    });

    return performAction(
      '/api/downloads/path',
      { id: selected.linkId, path: pathInput, packageId: selected.packageId, source: selected.source },
      `path-${selected.uuid}`,
      'Ruta de descarga actualizada'
    );
  };

  const openDetails = (download: JDDownload) => {
    setSelected(download);
    setIsEditingPath(false); // Reset editing flag when opening new drawer
    setDrawerOpen(true);
  };

  const getStatusBadge = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'running' || statusLower === 'downloading' || statusLower === 'extracting') return 'default';
    if (statusLower === 'finished' || statusLower === 'completed') return 'secondary';
    if (statusLower === 'failed' || statusLower === 'error') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Descargas
          </CardTitle>
          <CardDescription>Gestiona tus descargas de JDownloader</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{downloads.length}</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-xs text-muted-foreground">Descargando</div>
              <div className="text-2xl font-bold">{downloads.filter((d) => d.status.toLowerCase() === 'running' || d.status.toLowerCase() === 'downloading').length}</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-xs text-muted-foreground">Completadas</div>
              <div className="text-2xl font-bold">{downloads.filter((d) => d.status.toLowerCase() === 'finished' || d.status.toLowerCase() === 'completed').length}</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-xs text-muted-foreground">Fallidas</div>
              <div className="text-2xl font-bold">{downloads.filter((d) => d.status.toLowerCase() === 'failed' || d.status.toLowerCase() === 'error').length}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <div className="text-xs text-muted-foreground">Pendientes</div>
              <div className="text-2xl font-bold">{downloads.filter((d) => d.status.toLowerCase() === 'pending' || d.status.toLowerCase() === 'queued').length}</div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Buscar por nombre o host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="downloading">Descargando</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="failed">Fallidas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="icon"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Pausar refresco automático' : 'Activar refresco automático'}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Downloads List */}
      <Card>
        <CardHeader>
          <CardTitle>Cola de Descargas</CardTitle>
          <CardDescription>{filteredDownloads.length} de {downloads.length} descargas mostradas</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando descargas...</span>
            </div>
          ) : filteredDownloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Download className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay descargas</h3>
              <p className="text-muted-foreground text-center">
                {searchQuery || statusFilter !== 'all'
                  ? 'No se encontraron descargas con los filtros aplicados'
                  : 'No hay descargas activas en JDownloader'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDownloads.map((download) => {
                const statusLower = download.status.toLowerCase();
                const isRunning = statusLower === 'running' || statusLower === 'downloading' || statusLower === 'extracting';
                const isExtracting = statusLower === 'extracting';

                return (
                  <div
                    key={download.uuid}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition"
                    onClick={() => openDetails(download)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate mb-1">{download.name}</h4>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="outline" className="text-xs">Host: {download.host}</Badge>
                          <Badge variant="outline" className="text-xs">Tamaño: {formatSize(download.size)}</Badge>
                          {download.category && <Badge variant="secondary" className="text-xs">{download.category}</Badge>}
                        </div>
                        {isRunning && (
                          <div className="space-y-2">
                            <Progress value={isExtracting ? 50 : download.progress} className={`h-2 ${isExtracting ? 'progress-striped' : ''}`} />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{isExtracting ? 'Extrayendo…' : `${Math.round(download.progress)}%`}</span>
                              {!isExtracting && (
                                <span>{formatSpeed(download.speed)} • ETA: {formatETA(download.eta)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={getStatusBadge(download.status)} className="text-xs">
                          {download.status}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(download);
                            }}
                            title={t('components.viewDetails')}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer with details */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelected(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="truncate">{selected?.name || 'Detalles'}</DrawerTitle>
            <DrawerDescription>{selected?.status}</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {selected && (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-medium">{selected.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tamaño:</span>
                    <span className="font-medium">{formatSize(selected.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progreso:</span>
                    <span className="font-medium">{selected.status.toLowerCase() === 'extracting' ? 'Extrayendo…' : `${Math.round(selected.progress)}%`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Velocidad:</span>
                    <span className="font-medium">{formatSpeed(selected.speed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ETA:</span>
                    <span className="font-medium">{formatETA(selected.eta)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Añadido:</span>
                    <span className="font-medium text-xs">{formatDate(selected.addedAt)}</span>
                  </div>
                </div>

                {selected.url && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">URL</label>
                      <p className="text-sm break-all bg-muted p-2 rounded">{selected.url}</p>
                    </div>
                  </>
                )}

                {selected.saveTo && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Ruta de descarga</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="/ruta/de/descarga"
                          value={pathInput}
                          onChange={(e) => setPathInput(e.target.value)}
                          onFocus={() => setIsEditingPath(true)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleSetPath}
                          disabled={actionLoading === `path-${selected.uuid}`}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const statusLower = selected.status.toLowerCase();
                    const isRunning = statusLower === 'running' || statusLower === 'downloading' || statusLower === 'extracting';
                    const isLinkGrabber = selected.source === 'linkgrabber';
                    const isPending = statusLower === 'pending' || statusLower === 'queued';

                    return (
                      <>
                        {isLinkGrabber && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleResume(selected)}
                            disabled={actionLoading === `resume-${selected.uuid}`}
                            title={t('components.moveToDownloads')}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Mover a descargas
                          </Button>
                        )}
                        {!isLinkGrabber && (
                          <>
                            {isRunning && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handlePause(selected)}
                                disabled={actionLoading === `pause-${selected.uuid}`}
                              >
                                <Pause className="h-4 w-4 mr-1" />
                                Pausar
                              </Button>
                            )}
                            {!isRunning && (isPending || statusLower === 'stopped') && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleResume(selected)}
                                disabled={actionLoading === `resume-${selected.uuid}`}
                                title={isPending ? 'Iniciar descarga' : 'Reanudar descarga'}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {isPending ? 'Iniciar' : 'Reanudar'}
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtract(selected)}
                          disabled={actionLoading === `extract-${selected.uuid}`}
                        >
                          <Hammer className="h-4 w-4 mr-1" />
                          Extraer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStop(selected, false)}
                          disabled={actionLoading === `stop-${selected.uuid}-queue`}
                        >
                          <StopCircle className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Borrar files
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar archivos?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminarán de JDownloader y los archivos locales se borrarán.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleStop(selected, true)}
                                disabled={actionLoading === `stop-${selected.uuid}-files`}
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
