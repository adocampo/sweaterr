'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { DownloadsProvider, useDownloadsContext } from '@/contexts/downloads-context';
import {
  Settings,
  Download,
  Search,
  Globe,
  Cpu,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Activity,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Clock,
  HardDrive
} from 'lucide-react';
import Image from 'next/image';
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
import { FlareSolverrConfig } from '@/components/config/flaresolverr-config';
import { TmdbConfig } from '@/components/config/tmdb-config';
import { ForumConfig } from '@/components/config/forum-config';
import { ForumsTable } from '@/components/config/forums-table';
import { ForumSessionSettings } from '@/components/config/forum-session-settings';
import { SearchTester } from '@/components/testing/search-tester';
import { ResultViewer } from '@/components/testing/result-viewer';
import { JDownloaderTester } from '@/components/testing/jdownloader-tester';
import { TestingSettings } from '@/components/testing/testing-settings';
import { DownloadsManager } from '@/components/downloads/downloads-manager';
import { useForums, useJDownloaderConfig, useAIConfig, useFlareSolverrConfig, useTmdbConfig, useDownloads, useJDownloaders, useAIModels } from '@/hooks/use-api';
import { useTheme } from '@/components/theme-provider';
import { UserManagement } from '@/components/config/user-management';
import { LogViewer } from '@/components/config/log-viewer';
import { useI18n } from '@/hooks/use-i18n';
import { AIConfigForm } from '@/lib/types';
import { ConfigBackup } from '@/components/config/config-backup';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Sidebar } from '@/components/sidebar';

async function testAIConnection(values: AIConfigForm) {
  try {
    const res = await fetch('/api/config/ai/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    return {
      success: !!data.success,
      error: data.success ? data.message : (data.error || data.message),
      models: data?.data?.models as string[] | undefined,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function Home() {
  return (
    <DownloadsProvider>
      <HomeContent />
    </DownloadsProvider>
  );
}

function HomeContent() {
  const [activeSection, setActiveSection] = useState('overview');
  // Keep-alive: sections stay mounted once visited so background work and state persist
  const [visitedSections, setVisitedSections] = useState<Set<string>>(() => new Set(['overview']));
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [userLanguage, setUserLanguage] = useState<'es' | 'en'>('es');
  const { t } = useI18n(userLanguage);

  // Restore the last active section so reloads (e.g. language change) stay in place
  useEffect(() => {
    const saved = window.localStorage.getItem('sweaterr.activeSection');
    if (saved) setActiveSection(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('sweaterr.activeSection', activeSection);
  }, [activeSection]);

  // Get download stats from context (only components using this will re-render)
  const { totalSpeed, activeDownloadsCount, jDownloaderStats, jDownloaderDownloads, dbDownloads } = useDownloadsContext();

  // Testing state
  const [testingResults, setTestingResults] = useState<any[]>([]);
  const [testingPage, setTestingPage] = useState<number>(1);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [testingForumId, setTestingForumId] = useState('');
  const [testingQuery, setTestingQuery] = useState('');
  const [testingSearchMode, setTestingSearchMode] = useState<'native' | 'google_site' | 'google_cse' | undefined>(undefined);
  const [testingSearchId, setTestingSearchId] = useState<string | undefined>(undefined);
  const [testingTotalResults, setTestingTotalResults] = useState<number | undefined>(undefined);

  // Edit state
  const [editingJDownloader, setEditingJDownloader] = useState<string | null>(null);
  const [editingForum, setEditingForum] = useState<string | null>(null);
  const [editingAIModel, setEditingAIModel] = useState<string | null>(null);
  const [editingFlareSolverr, setEditingFlareSolverr] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { forums, loading: forumsLoading, createForum, updateForum, deleteForum, refetch: refetchForums, testConnection: testForumConnection } = useForums();
  const { instances: jdownloaders, loading: jdLoading, createInstance: createJDownloader, deleteInstance: deleteJDownloader, toggleInstance: toggleJDownloader, refetch: refetchJDownloaders } = useJDownloaders();
  const { models: aiModels, loading: aiLoading, createModel: createAIModel, deleteModel: deleteAIModel, toggleModel: toggleAIModel, refetch: refetchAIModels } = useAIModels();
  const { config: flaresolverrConfig, status: flaresolverrStatus, refetch: refetchFlareSolverrConfig, saveConfig: saveFlareSolverrConfig, toggleConfig: toggleFlareSolverrConfig, testConnection: testFlareSolverrConnection, refreshStatus: refreshFlareSolverrStatus, deleteConfig: deleteFlareSolverrConfig } = useFlareSolverrConfig();
  const { config: tmdbConfig, saveConfig: saveTmdbConfig, testConnection: testTmdbConnection, deleteConfig: deleteTmdbConfig } = useTmdbConfig();
  const { theme, setTheme } = useTheme();

  const isAdmin = currentUser?.role === 'admin';

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

  // Fetch current user for user menu (only once on mount)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const data = await res.json();
        if (mounted) {
          if (data?.success && data.user) {
            setCurrentUser(data.user);
            if (data.user?.language) {
              setUserLanguage(data.user.language as 'es' | 'en');
            }
            if (data.user?.theme) {
              setTheme(data.user.theme as 'light' | 'dark' | 'system');
            }
          } else {
            // User not authenticated, redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
              return;
            }
          }
        }
      } catch (err) {
        console.error('Failed to load current user', err);
        // On error, redirect to login
        if (mounted && typeof window !== 'undefined') {
          window.location.href = '/login';
          return;
        }
      } finally {
        if (mounted) setLoadingUser(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loadingUser && !isAdmin && activeSection.startsWith('settings-')) {
      setActiveSection('overview');
    }
  }, [loadingUser, isAdmin, activeSection]);

  useEffect(() => {
    setVisitedSections((prev) => {
      if (prev.has(activeSection)) return prev;
      const next = new Set(prev);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  // Format speed in human-readable format
  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond) return '0 KB/s';
    const mbps = bytesPerSecond / (1024 * 1024);
    if (mbps >= 1) return `${mbps.toFixed(2)} MB/s`;
    const kbps = bytesPerSecond / 1024;
    return `${kbps.toFixed(2)} KB/s`;
  };

  // Format ETA in human-readable format
  const formatETA = (seconds: number) => {
    if (!seconds || seconds < 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
        (jdownloaders as any[])[0]?.mode === 'local'
          ? `${(jdownloaders as any[])[0]?.localHost ?? ''}:${(jdownloaders as any[])[0]?.localPort ?? ''}`
          : (jdownloaders as any[])[0]?.deviceName || t('dashboard.notConfigured'),
      downloadsActive: dbDownloads.filter(d => d.status === 'downloading').length,
      downloadsTotal: dbDownloads.length
    },
    downloads: {
      total: dbDownloads.length,
      pending: dbDownloads.filter(d => d.status === 'pending').length,
      downloading: dbDownloads.filter(d => d.status === 'downloading').length,
      completed: dbDownloads.filter(d => d.status === 'completed').length,
      failed: dbDownloads.filter(d => d.status === 'failed').length
    },
    ai: {
      provider: aiModels[0]?.provider || t('dashboard.notConfigured'),
      model: aiModels[0]?.model || t('dashboard.notConfigured'),
      connected: aiModels.length > 0
    }
  };

  return (
    <DashboardLayout>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isAdmin={isAdmin}
        language={userLanguage}
        user={currentUser}
        currentTheme={theme}
        onThemeChange={setTheme}
      />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="w-full p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Sweaterr" width={160} height={40} priority className="h-10 w-auto" />
                <span className="sr-only">Sweaterr</span>
              </div>
              <p className="text-muted-foreground">
                {t('dashboard.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={activeDownloadsCount > 0 ? "default" : "outline"}
                className="flex items-center gap-1"
              >
                <Activity className="h-3 w-3" />
                {activeDownloadsCount > 0 ? formatSpeed(totalSpeed) : t('dashboard.idle')}
              </Badge>

            </div>
          </div>

          {/* Overview Section */}
          {visitedSections.has('overview') && (
            <div className={activeSection === 'overview' ? 'space-y-6' : 'hidden'}>
              {/* Gradient Status Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Forums Status */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 shadow-lg transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5">
                  {/* Gradient accent */}
                  <div className={`absolute top-0 left-0 right-0 h-0.5 transition-opacity duration-300 ${stats.forums.online > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-rose-400'} opacity-100`} />
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Large gradient icon */}
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stats.forums.online > 0 ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30' : 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30'}`}>
                        <Globe className={`h-5 w-5 ${stats.forums.online > 0 ? 'text-green-400' : 'text-red-400'}`} />
                        {stats.forums.online > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900"></span>
                          </span>
                        )}
                      </div>
                      
                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.forums')}</h3>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={`text-2xl font-bold tracking-tight ${stats.forums.online > 0 ? 'text-white' : 'text-gray-400'}`}>{stats.forums.online}</span>
                          <span className="text-sm text-gray-500">/ {stats.forums.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`h-1.5 flex-1 rounded-full ${stats.forums.online > 0 ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-600 to-rose-400'}`} style={{width: `${stats.forums.total > 0 ? (stats.forums.online / stats.forums.total) * 100 : 0}%`}}></div>
                      <span className="text-xs text-gray-500">{t('dashboard.online')}</span>
                    </div>
                  </div>
                </div>

                {/* JDownloader Status */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 shadow-lg transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${stats.jdownloader.connected ? 'bg-gradient-to-r from-cyan-500 to-blue-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`} />
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stats.jdownloader.connected ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' : 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30'}`}>
                        <Download className={`h-5 w-5 ${stats.jdownloader.connected ? 'text-cyan-400' : 'text-red-400'}`} />
                        {stats.jdownloader.connected && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500 border-2 border-gray-900"></span>
                          </span>
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.jdownloaderStatus')}</h3>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={`text-2xl font-bold tracking-tight ${stats.jdownloader.connected ? 'text-white' : 'text-gray-400'}`}>{stats.jdownloader.downloadsActive}</span>
                          <span className="text-sm text-gray-500">active</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`h-1.5 flex-1 rounded-full overflow-hidden ${stats.jdownloader.connected ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' : 'bg-gradient-to-r from-red-600 to-rose-400'}`}>
                        <div className="h-full w-full rounded-full animate-pulse"></div>
                      </div>
                      <span className="text-xs text-gray-500 truncate">{stats.jdownloader.deviceName}</span>
                    </div>
                  </div>
                </div>

                {/* AI Status */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 shadow-lg transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${stats.ai.connected ? 'bg-gradient-to-r from-violet-500 to-purple-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`} />
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stats.ai.connected ? 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30' : 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30'}`}>
                        <Cpu className={`h-5 w-5 ${stats.ai.connected ? 'text-violet-400' : 'text-red-400'}`} />
                        {stats.ai.connected && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-violet-500 border-2 border-gray-900"></span>
                          </span>
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.aiStatus')}</h3>
                        <div className="mt-0.5">
                          <span className={`text-2xl font-bold tracking-tight ${stats.ai.connected ? 'text-white' : 'text-gray-400'}`}>{stats.ai.provider}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`h-1.5 flex-1 rounded-full ${stats.ai.connected ? 'bg-gradient-to-r from-violet-600 to-violet-400' : 'bg-gradient-to-r from-red-600 to-rose-400'}`} style={{width: `${stats.ai.connected ? '100%' : '0%'}`}}></div>
                      <span className="text-xs text-gray-500 truncate">{stats.ai.model}</span>
                    </div>
                  </div>
                </div>

                {/* FlareSolverr Status */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 shadow-lg transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${flaresolverrStatus === 'ok' ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`} />
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${flaresolverrStatus === 'ok' ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30' : 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30'}`}>
                        <Server className={`h-5 w-5 ${flaresolverrStatus === 'ok' ? 'text-amber-400' : 'text-red-400'}`} />
                        {flaresolverrStatus === 'ok' && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500 border-2 border-gray-900"></span>
                          </span>
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">FlareSolverr</h3>
                        <div className="mt-0.5">
                          <span className={`text-sm font-bold ${flaresolverrStatus === 'ok' ? 'text-white' : 'text-red-400'}`}>
                            {flaresolverrStatus === 'ok'
                              ? t('flaresolverrConfig.statusOnline')
                              : flaresolverrStatus === 'error'
                                ? t('flaresolverrConfig.statusError')
                                : t('flaresolverrConfig.statusOffline')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className={`h-1.5 flex-1 rounded-full ${flaresolverrStatus === 'ok' ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-red-600 to-rose-400'}`} style={{width: `${flaresolverrStatus === 'ok' ? '100%' : '0%'}`}}></div>
                      <span className="text-xs text-gray-500 truncate" title={flaresolverrConfig?.url || undefined}>{flaresolverrConfig?.url || t('dashboard.notConfigured')}</span>
                    </div>
                  </div>
                </div>

                {/* Total Downloads */}
                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 shadow-lg transition-all duration-300 hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5">
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${jDownloaderStats.downloading > 0 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-gray-600 to-gray-500'}`} />
                  
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${jDownloaderStats.downloading > 0 ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30' : 'bg-gradient-to-br from-gray-600/20 to-gray-500/20 border border-gray-600/30'}`}>
                        <Activity className={`h-5 w-5 ${jDownloaderStats.downloading > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
                        {jDownloaderStats.downloading > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-gray-900"></span>
                          </span>
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('dashboard.totalDownloads')}</h3>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className={`text-2xl font-bold tracking-tight ${jDownloaderStats.downloading > 0 ? 'text-white' : 'text-gray-400'}`}>{jDownloaderStats.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center gap-2">
                      {/* Mini status bars */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          {jDownloaderStats.downloading}
                        </span>
                        <span className="flex items-center gap-1 text-blue-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                          {jDownloaderStats.completed}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                          {jDownloaderStats.failed}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Downloads */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard.recentDownloads')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.jdownloaderDownloads')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {jDownloaderDownloads.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('dashboard.noRecentDownloads')}</p>
                  ) : (
                    <div className="space-y-3">
                      {jDownloaderDownloads.slice(0, 10).map((download, index) => {
                        const statusColor = {
                          'running': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                          'downloading': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                          'extracting': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                          'completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                          'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                          'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }[download.status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';

                        return (
                          <div key={download.uuid || index} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium text-sm truncate flex-1">{download.name}</h4>
                                <Badge className={`text-xs whitespace-nowrap ${statusColor}`}>
                                  {download.status.toLowerCase() === 'running' ? 'downloading' : download.status.toLowerCase()}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {download.host}
                                </span>
                                {download.size && (
                                  <span className="flex items-center gap-1">
                                    <Download className="h-3 w-3" />
                                    {(download.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                                  </span>
                                )}
                                {download.speed > 0 && (
                                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <Activity className="h-3 w-3" />
                                    {formatSpeed(download.speed)}
                                  </span>
                                )}
                              </div>
                              {(download.status.toLowerCase() === 'running' || download.status.toLowerCase() === 'downloading' || download.status.toLowerCase() === 'extracting') && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <Progress value={download.progress || 0} className="h-2 flex-1" />
                                    <span className="text-xs font-semibold ml-2">{Math.round(download.progress || 0)}%</span>
                                  </div>
                                  {download.eta > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      ETA: {formatETA(download.eta)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Testing Section */}
          {visitedSections.has('testing') && (
            <div className={activeSection === 'testing' ? 'space-y-6' : 'hidden'}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.testingEmulation')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.testingDescription')}
                </p>
              </div>

              <div className="space-y-6">
                <TestingSettings language={userLanguage} />

                <SearchTester
                  forums={forums as any}
                  language={userLanguage}
                  onSearchResults={(results, forumId, query, searchMode, searchId, totalResults) => {
                    setTestingResults(results);
                    setTestingForumId(forumId);
                    setTestingQuery(query);
                    setTestingSearchMode(searchMode);
                    setTestingSearchId(searchId);
                    setTestingTotalResults(totalResults);
                    setTestingPage(1);
                  }}
                />

                {testingResults.length > 0 && (
                  <ResultViewer
                    results={testingResults}
                    forumId={testingForumId}
                    searchQuery={testingQuery}
                    searchMode={testingSearchMode}
                    loadingMore={loadingMore}
                    totalResults={testingTotalResults}
                    language={userLanguage}
                    onLoadMore={async () => {
                      try {
                        setLoadingMore(true);
                        const nextPage = testingPage + 1;
                        const response = await fetch('/api/testing/search', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            forumId: testingForumId,
                            query: testingQuery,
                            page: nextPage,
                            searchId: testingSearchId,
                          }),
                        });
                        const data = await response.json();
                        if (data?.success && Array.isArray(data.results)) {
                          // Deduplicate by URL while appending
                          const existing = new Set((testingResults || []).map((r: any) => r.url));
                          const merged = [...testingResults];
                          for (const r of data.results) {
                            if (r?.url && !existing.has(r.url)) {
                              merged.push(r);
                              existing.add(r.url);
                            }
                          }
                          setTestingResults(merged);
                          setTestingSearchMode(data.searchMode || testingSearchMode);
                          // Update searchId and totalResults in case they change
                          if (data.searchId) setTestingSearchId(data.searchId);
                          if (data.totalResults) setTestingTotalResults(data.totalResults);
                          if (data.results.length > 0) setTestingPage(nextPage);
                        }
                      } finally {
                        setLoadingMore(false);
                      }
                    }}
                    onLoadAll={async () => {
                      try {
                        setLoadingMore(true);
                        const response = await fetch('/api/testing/search', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            forumId: testingForumId,
                            query: testingQuery,
                            fetchAll: true,
                            searchId: testingSearchId,
                          }),
                        });
                        const data = await response.json();
                        if (data?.success && Array.isArray(data.results)) {
                          // Merge and deduplicate against current results
                          const existing = new Set((testingResults || []).map((r: any) => r.url));
                          const merged = [...testingResults];
                          for (const r of data.results) {
                            if (r?.url && !existing.has(r.url)) {
                              merged.push(r);
                              existing.add(r.url);
                            }
                          }
                          setTestingResults(merged);
                          setTestingSearchMode(data.searchMode || testingSearchMode);
                          // Update totalResults if available
                          if (data.totalResults) setTestingTotalResults(data.totalResults);
                        }
                      } finally {
                        setLoadingMore(false);
                      }
                    }}
                    onExtractLinks={(links, postUrl) => {
                      console.log('Extracted links:', links, 'from', postUrl);
                    }}
                  />
                )}

                <JDownloaderTester language={userLanguage} />
              </div>
            </div>
          )}

          {/* Downloads Section */}
          {visitedSections.has('downloads') && (
            <div className={activeSection === 'downloads' ? undefined : 'hidden'}>
              <DownloadsManager language={userLanguage} />
            </div>
          )}

          {/* Settings: Connections Section */}
          {visitedSections.has('settings-connections') && isAdmin && (
            <div className={activeSection === 'settings-connections' ? 'space-y-6' : 'hidden'}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.configuration')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.configureServices')}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      TMDB
                    </CardTitle>
                    <CardDescription>{t('tmdbConfig.description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{t('tmdbConfig.status')}</h3>
                        <TmdbConfig
                          onConfigSave={saveTmdbConfig}
                          onTestConnection={testTmdbConnection}
                          isAdd
                          isAddDisabled={!!tmdbConfig?.apiKey}
                          language={userLanguage}
                        />
                      </div>
                      {tmdbConfig?.apiKey ? (
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={tmdbConfig.enabled ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-orange-500/10 text-orange-700 dark:text-orange-400'}>
                                {tmdbConfig.enabled ? t('tmdbConfig.statusOnline') : t('config.disabled')}
                              </Badge>
                              <Badge variant="secondary">{tmdbConfig.source === 'database' ? t('tmdbConfig.sourceDatabase') : t('tmdbConfig.sourceEnvironment')}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">TMDB API</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TmdbConfig config={tmdbConfig} onConfigSave={saveTmdbConfig} onTestConnection={testTmdbConnection} isEdit language={userLanguage} />
                            {tmdbConfig.source === 'database' && (
                              <Button variant="destructive" size="icon" title={t('common.delete')} onClick={() => void deleteTmdbConfig()}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">{t('tmdbConfig.statusUnknown')}</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      FlareSolverr
                    </CardTitle>
                    <CardDescription>
                      {t('flaresolverrConfig.description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{t('flaresolverrConfig.status')}</h3>
                        <FlareSolverrConfig
                          config={undefined}
                          onConfigSave={async (values) => {
                            await saveFlareSolverrConfig(values);
                            await refetchFlareSolverrConfig();
                          }}
                          onTestConnection={async (values) => testFlareSolverrConnection(values)}
                          isAdd={true}
                          isAddDisabled={!!flaresolverrConfig?.url}
                          language={userLanguage}
                        />
                      </div>

                      {flaresolverrConfig?.url ? (
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {flaresolverrStatus === 'ok' ? (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">{t('flaresolverrConfig.statusOnline')}</Badge>
                              ) : flaresolverrStatus === 'error' ? (
                                <Badge variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">{t('flaresolverrConfig.statusError')}</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">{t('flaresolverrConfig.statusOffline')}</Badge>
                              )}
                              <Badge variant="secondary">
                                {flaresolverrConfig.source === 'database'
                                  ? t('flaresolverrConfig.sourceDatabase')
                                  : t('flaresolverrConfig.sourceEnvironment')}
                              </Badge>
                            </div>
                            <div className="max-w-xs truncate text-xs text-muted-foreground">{flaresolverrConfig.url}</div>
                            <div className="text-xs text-muted-foreground">{flaresolverrConfig.timeout} ms</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={async () => {
                                await toggleFlareSolverrConfig(!flaresolverrConfig.enabled);
                                await refreshFlareSolverrStatus();
                              }}
                              title={flaresolverrConfig.enabled ? t('config.enabled') : t('config.disabled')}
                            >
                              {flaresolverrConfig.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                            </Button>
                            <FlareSolverrConfig
                              config={flaresolverrConfig}
                              onConfigSave={async (values) => {
                                await saveFlareSolverrConfig(values);
                                await refetchFlareSolverrConfig();
                                setEditingFlareSolverr(false);
                              }}
                              onTestConnection={async (values) => testFlareSolverrConnection(values)}
                              isEdit={true}
                              isOpen={editingFlareSolverr}
                              onOpenChange={setEditingFlareSolverr}
                              language={userLanguage}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title={t('common.delete')}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('flaresolverrConfig.deleteTitle')}</AlertDialogTitle>
                                  <AlertDialogDescription>{t('flaresolverrConfig.deleteDescription')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={async () => { await deleteFlareSolverrConfig(); }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t('common.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('flaresolverrConfig.statusUnknown')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      {t('config.jdownloader')}
                    </CardTitle>
                    <CardDescription>
                      {t('dashboard.jdownloaderConfig')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{t('config.jdownloader')}</h3>
                        <JDownloaderConfig
                          config={undefined}
                          onConfigSave={async (values) => {
                            await createJDownloader(values);
                          }}
                          onTestConnection={async (values) => {
                            const res = await fetch('/api/config/jdownloader/check', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(values),
                            });
                            const data = await res.json();
                            return !!data.success;
                          }}
                          isAdd={true}
                          language={userLanguage}
                        />
                      </div>

                      <div className="space-y-2">
                        {jdLoading ? (
                          <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
                        ) : jdownloaders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('dashboard.noJDownloaders')}</p>
                        ) : (
                          (jdownloaders as any[]).map((jd) => (
                            <div key={jd.id} className="flex items-center justify-between border rounded-md p-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {jd.mode === 'local' ? (jd.connectionName || `${jd.localHost}:${jd.localPort}`) : jd.deviceName}
                                  </span>
                                  <Badge variant={jd.mode === 'local' ? 'secondary' : 'outline'}>
                                    {jd.mode === 'local' ? t('dashboard.localMode') : t('dashboard.cloudMode')}
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
                                    const res = await fetch('/api/config/jdownloader/check', {
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
                                  language={userLanguage}
                                />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('dashboard.deleteJDownloader')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t('dashboard.deleteJDownloaderDesc')} <strong>{jd.deviceName}</strong>.
                                        {t('dashboard.undoNotPossible')}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
                                        {t('common.delete')}
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
                      {t('config.ai')}
                    </CardTitle>
                    <CardDescription>
                      {t('dashboard.aiConfig')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{t('dashboard.aiModels')}</h3>
                        <AIConfig
                          config={undefined}
                          onConfigSave={async (values) => {
                            await createAIModel(values);
                          }}
                          onTestConnection={testAIConnection}
                          isAdd={true}
                          language={userLanguage}
                        />
                      </div>

                      <div className="space-y-2">
                        {aiLoading ? (
                          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                        ) : aiModels.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('dashboard.noAIModels')}</p>
                        ) : (
                          aiModels.map((ai) => (
                            <div key={ai.id} className="flex items-center justify-between border rounded-md p-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{ai.provider}</span>
                                  <Badge variant="secondary">{ai.model || t('dashboard.defaultModel')}</Badge>
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
                                  onTestConnection={testAIConnection}
                                  isEdit={true}
                                  isOpen={editingAIModel === ai.id}
                                  onOpenChange={(open) => setEditingAIModel(open ? ai.id : null)}
                                  language={userLanguage}
                                />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('dashboard.deleteAIModel')}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t('dashboard.deleteAIModelDesc')} <strong>{ai.provider}</strong>.
                                        {t('dashboard.deleteAIModelUndoNotPossible')}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
              </div>
            </div>
          )}

          {/* Settings: Backup Section */}
          {visitedSections.has('settings-backup') && isAdmin && (
            <div className={activeSection === 'settings-backup' ? 'space-y-6' : 'hidden'}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.backupRestore')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.backupRestoreDescription')}
                </p>
              </div>
              <ConfigBackup language={userLanguage} />
            </div>
          )}

          {/* Settings: Users Section */}
          {visitedSections.has('settings-users') && isAdmin && (
            <div className={activeSection === 'settings-users' ? 'space-y-6' : 'hidden'}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.userManagement')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.createEditDeleteUsers')}
                </p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <UserManagement language={userLanguage} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings: Logs Section */}
          {visitedSections.has('settings-logs') && isAdmin && (
            <div className={activeSection === 'settings-logs' ? 'space-y-6' : 'hidden'}>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h2>
                <p className="text-muted-foreground">
                  {t('logs.description')}
                </p>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <LogViewer language={userLanguage} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings: Forums Section */}
          {visitedSections.has('settings-forums') && isAdmin && (
            <div className={activeSection === 'settings-forums' ? 'space-y-6' : 'hidden'}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.configuredForums')}</h2>
                  <p className="text-muted-foreground">
                    {t('dashboard.manageForums')}
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
                  language={userLanguage}
                />
              </div>

              {forumsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : forums.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">{t('dashboard.noForumsConfigured')}</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      {t('dashboard.noForumsDescription')}
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
                      language={userLanguage}
                    />
                  </CardContent>
                </Card>
              ) : (
                <ForumsTable
                  forums={forums}
                  language={userLanguage}
                  onEdit={(forum) => {
                    setEditingForum(forum.id);
                  }}
                  onDelete={async (forumId) => {
                    try {
                      await deleteForum(forumId);
                      refetchForums();
                    } catch (error) {
                      console.error('Error deleting forum:', error);
                      throw error;
                    }
                  }}
                />
              )}

              {editingForum && (
                <ForumConfig
                  config={(() => {
                    const forum = forums.find((f) => f.id === editingForum);
                    if (!forum) return undefined;
                    return {
                      name: forum.name,
                      baseUrl: forum.baseUrl,
                      searchPath: forum.searchPath,
                      searchMode: (forum as any).searchMode,
                      searchForumLabel: (forum as any).searchForumLabel || undefined,
                      searchInChildForums: (forum as any).searchInChildForums ?? false,
                      searchTitleOnly: (forum as any).searchTitleOnly ?? true,
                      sabnzbdCategory: (forum as any).sabnzbdCategory || undefined,
                      cseId: (forum as any).cseId,
                      thankButtonSelector: forum.thankButtonSelector || undefined,
                      linksContainerSelector: forum.linksContainerSelector || undefined,
                      postTitleSelector: forum.postTitleSelector || undefined,
                      requiresAuthentication: (forum as any).requiresAuthentication ?? !!forum.credentials?.username,
                      username: forum.credentials?.username,
                      password: forum.credentials?.password,
                      useFlaresolverr: (forum as any).useFlaresolverr ?? true,
                      // Convert stored TTL (ms) to minutes for the form
                      flaresolverrSessionTTL: typeof (forum as any).flaresolverrSessionTTL === 'number'
                        ? Math.round((forum as any).flaresolverrSessionTTL / 60000)
                        : 30,
                    };
                  })()}
                  onConfigSave={async (values) => {
                    try {
                      await updateForum(editingForum, values);
                      refetchForums();
                      setEditingForum(null);
                    } catch (error) {
                      console.error('Error updating forum:', error);
                    }
                  }}
                  onTestConnection={testForumConnection}
                  isEdit={true}
                  forumId={editingForum}
                  isOpen={!!editingForum}
                  onOpenChange={(open) => !open && setEditingForum(null)}
                  language={userLanguage}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
