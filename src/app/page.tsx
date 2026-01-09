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
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2
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
import { ForumConfig } from '@/components/config/forum-config';
import { ForumsTable } from '@/components/config/forums-table';
import { ForumSessionSettings } from '@/components/config/forum-session-settings';
import { ArrConfig } from '@/components/config/arr-config';
import { SearchTester } from '@/components/testing/search-tester';
import { ResultViewer } from '@/components/testing/result-viewer';
import { JDownloaderTester } from '@/components/testing/jdownloader-tester';
import { TestingSettings } from '@/components/testing/testing-settings';
import { DownloadsManager } from '@/components/downloads/downloads-manager';
import { useForums, useJDownloaderConfig, useAIConfig, useDownloads, useJDownloaders, useAIModels } from '@/hooks/use-api';
import { useTheme } from '@/components/theme-provider';
import { UserMenu } from '@/components/user-menu';
import { UserManagement } from '@/components/config/user-management';
import { useI18n } from '@/hooks/use-i18n';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [userLanguage, setUserLanguage] = useState<'es' | 'en'>('es');
  const { t } = useI18n(userLanguage);

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

  const { forums, loading: forumsLoading, createForum, updateForum, deleteForum, refetch: refetchForums, testConnection: testForumConnection } = useForums();
  const { instances: jdownloaders, loading: jdLoading, createInstance: createJDownloader, deleteInstance: deleteJDownloader, toggleInstance: toggleJDownloader, refetch: refetchJDownloaders } = useJDownloaders();
  const { models: aiModels, loading: aiLoading, createModel: createAIModel, deleteModel: deleteAIModel, toggleModel: toggleAIModel, refetch: refetchAIModels } = useAIModels();
  const { downloads, loading: downloadsLoading } = useDownloads();
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

  // Fetch current user for user menu
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (mounted && data?.success) {
          setCurrentUser(data.user);
          if (data.user?.language) {
            setUserLanguage(data.user.language as 'es' | 'en');
          }
          if (data.user?.theme) {
            setTheme(data.user.theme as 'light' | 'dark' | 'system');
          }
        }
      } catch (err) {
        console.error('Failed to load current user', err);
      } finally {
        if (mounted) setLoadingUser(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loadingUser && !isAdmin && activeTab === 'config') {
      setActiveTab('overview');
    }
  }, [loadingUser, isAdmin, activeTab]);

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
          : (jdownloaders as any[])[0]?.deviceName || 'No configurado',
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
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {t('dashboard.active')}
          </Badge>
          {!loadingUser && currentUser && (
            <UserMenu user={currentUser} onThemeChange={(t) => setTheme(t)} currentTheme={theme} />
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="overview">{t('dashboard.overview')}</TabsTrigger>
          <TabsTrigger value="forums">{t('dashboard.forums')}</TabsTrigger>
          <TabsTrigger value="testing">{t('dashboard.testing')}</TabsTrigger>
          <TabsTrigger value="downloads">{t('dashboard.downloads')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="config">Configuración</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Forums Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.forums')}</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.forums.online}/{stats.forums.total}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.online')}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(stats.forums.online > 0)}
                  <span className="text-xs">{t('dashboard.online')}</span>
                </div>
              </CardContent>
            </Card>

            {/* JDownloader Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.jdownloaderStatus')}</CardTitle>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.jdownloader.downloadsActive}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.activeDownloads')}
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
                <CardTitle className="text-sm font-medium">{t('dashboard.aiStatus')}</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ai.provider}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.ai.model}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(stats.ai.connected)}
                  <span className="text-xs">{t('dashboard.connected')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Total Downloads */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.totalDownloads')}</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.jdownloader.downloadsTotal}</div>
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.historical')}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">{t('dashboard.operational')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Downloads */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recentDownloads')}</CardTitle>
              <CardDescription>
                {t('dashboard.lastDownloads')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {downloadsLoading ? (
                <p>{t('dashboard.loadingDownloads')}</p>
              ) : downloads.length === 0 ? (
                <p className="text-muted-foreground">{t('dashboard.noRecentDownloads')}</p>
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
                          <span>{t('dashboard.forum')}: {download.forumName}</span>
                          {download.size && <span>{t('dashboard.size')}: {download.size}</span>}
                        </div>
                        {download.status === 'downloading' && (
                          <div className="mt-2">
                            <Progress value={download.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.round(download.progress)}% {t('dashboard.completed')}
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
                  cseId: (forum as any).cseId,
                  thankButtonSelector: forum.thankButtonSelector || undefined,
                  linksContainerSelector: forum.linksContainerSelector || undefined,
                  postTitleSelector: forum.postTitleSelector || undefined,
                  username: forum.credentials?.username,
                  password: forum.credentials?.password,
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
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.testingEmulation')}</h2>
            <p className="text-muted-foreground">
              {t('dashboard.testingDescription')}
            </p>
          </div>

          <div className="space-y-6">
            <TestingSettings />

            <SearchTester
              forums={forums as any}
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

            <JDownloaderTester />
          </div>
        </TabsContent>

        {/* Downloads Tab */}
        <TabsContent value="downloads" className="space-y-6">
          <DownloadsManager language={userLanguage} />
        </TabsContent>

        {/* Configuration Tab */}
        {isAdmin && (
          <TabsContent value="config" className="space-y-6">
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
                    <Settings className="h-5 w-5" />
                    {t('dashboard.userManagement')}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard.createEditDeleteUsers')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement language={userLanguage} />
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
                                <span className="font-medium text-sm">{ai.model || t('dashboard.defaultModel')}</span>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t('config.arr')}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard.arrServices')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ArrConfig />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}