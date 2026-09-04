'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Loader2, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks/use-i18n';

interface LogEntry {
    id: string;
    source: string;
    timestamp: string;
    line: string;
}

interface LogViewerProps {
    language?: 'es' | 'en';
}

export function LogViewer({ language = 'es' }: LogViewerProps) {
    const { t } = useI18n(language);
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [sources, setSources] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const [query, setQuery] = useState('');
    const [live, setLive] = useState(true);
    const [newestFirst, setNewestFirst] = useState(true);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const shouldFollowTailRef = useRef(true);
    const sourceSelectorRef = useRef<HTMLDivElement>(null);

    // Close source selector when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sourceSelectorRef.current && !sourceSelectorRef.current.contains(event.target as Node)) {
                setShowSourceSelector(false);
            }
        };
        if (showSourceSelector) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSourceSelector]);

    const toggleSource = (source: string) => {
        setSelectedSources((prev) => {
            const next = new Set(prev);
            if (next.has(source)) {
                next.delete(source);
            } else {
                next.add(source);
            }
            return next;
        });
    };

    const selectAllSources = () => {
        setSelectedSources(new Set(sources));
    };

    const clearAllSources = () => {
        setSelectedSources(new Set());
    };

    useEffect(() => {
        let cancelled = false;

        const loadLogs = async () => {
            try {
                // On first mount or when no sources selected, load all to populate sources list
                if (sources.length === 0) {
                    setLoading(true);
                    const params = new URLSearchParams();
                    params.append('source', 'all');
                    const response = await fetch(`/api/logs?${params.toString()}`, {
                        credentials: 'include',
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error || t('logs.loadError'));
                    if (!cancelled) {
                        setEntries(data.data.entries || []);
                        setSources(data.data.sources || []);
                        setError(null);
                    }
                    setLoading(false);
                } else if (selectedSources.size === 0) {
                    // Sources are known but none selected — show empty
                    setEntries([]);
                    setLoading(false);
                } else {
                    setLoading(true);
                    const params = new URLSearchParams();
                    selectedSources.forEach((source) => params.append('source', source));
                    const response = await fetch(`/api/logs?${params.toString()}`, {
                        credentials: 'include',
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error || t('logs.loadError'));
                    if (!cancelled) {
                        setEntries(data.data.entries || []);
                        setError(null);
                    }
                    setLoading(false);
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError instanceof Error ? loadError.message : t('logs.loadError'));
                setLoading(false);
            }
        };

        loadLogs();
        if (!live) return () => { cancelled = true; };
        const timer = window.setInterval(loadLogs, 2000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [live, selectedSources, sources, t]);

    // Auto-select all sources only on initial mount
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (sources.length > 0 && selectedSources.size === 0 && !hasInitializedRef.current) {
            setSelectedSources(new Set(sources));
            hasInitializedRef.current = true;
        }
    }, [sources]);

    const normalizedQuery = query.trim().toLowerCase();
    const visibleEntries = normalizedQuery
        ? entries.filter((entry) => entry.line.toLowerCase().includes(normalizedQuery))
        : entries;
    const orderedEntries = newestFirst ? [...visibleEntries].reverse() : visibleEntries;

    useEffect(() => {
        const container = logContainerRef.current;
        if (!container || newestFirst || !live || !shouldFollowTailRef.current) return;
        container.scrollTop = container.scrollHeight;
    }, [orderedEntries, newestFirst, live]);

    const handleScroll = () => {
        const container = logContainerRef.current;
        if (!container) return;
        shouldFollowTailRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 16;
    };

    const clearLogs = async () => {
        const scope = selectedSources.size === 0
            ? t('logs.all')
            : selectedSources.size === sources.length
                ? t('logs.all')
                : Array.from(selectedSources).join(', ');
        if (!window.confirm(t('logs.clearConfirm', { scope }))) return;

        try {
            setClearing(true);
            const params = new URLSearchParams();
            if (selectedSources.size === 0 || selectedSources.size === sources.length) {
                params.append('source', 'all');
            } else {
                selectedSources.forEach((s) => params.append('source', s));
            }
            const response = await fetch(`/api/logs?${params.toString()}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || t('logs.clearError'));
            setEntries([]);
            setError(null);
        } catch (clearError) {
            setError(clearError instanceof Error ? clearError.message : t('logs.clearError'));
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('logs.filterPlaceholder')}
                        className="pl-9"
                    />
                </div>
                <div ref={sourceSelectorRef} className="relative shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSourceSelector(!showSourceSelector)}
                        className="gap-1.5"
                    >
                        {selectedSources.size === 0
                            ? t('logs.noSources')
                            : selectedSources.size === sources.length
                                ? t('logs.all')
                                : `${selectedSources.size}/${sources.length}`}
                    </Button>
                    {showSourceSelector && (
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-md border bg-popover p-2 shadow-md">
                            <div className="mb-2 flex gap-1">
                                <Button variant="ghost" size="sm" onClick={selectAllSources} className="h-7 text-xs">
                                    {t('logs.selectAll')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={clearAllSources} className="h-7 text-xs">
                                    {t('logs.clearAll')}
                                </Button>
                            </div>
                            <div className="space-y-1">
                                {sources.map((item) => (
                                    <div
                                        key={item}
                                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                                    >
                                        <Badge
                                            variant={selectedSources.has(item) ? 'secondary' : 'secondary'}
                                            className={selectedSources.has(item)
                                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                                : 'bg-red-500/10 text-red-700 dark:text-red-400'}
                                        >
                                            {item}
                                        </Badge>
                                        <Switch
                                            checked={selectedSources.has(item)}
                                            onCheckedChange={() => toggleSource(item)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
                    <Switch checked={live} onCheckedChange={setLive} aria-label={t('logs.live')} />
                    {t('logs.live')}
                </label>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewestFirst((value) => !value)}
                    title={newestFirst ? t('logs.oldestFirst') : t('logs.newestFirst')}
                >
                    <ArrowDownUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    onClick={clearLogs}
                    disabled={clearing}
                    title={t('logs.clear')}
                >
                    {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
            </div>

            {error ? (
                <p className="text-sm text-destructive">{error}</p>
            ) : (
                <div ref={logContainerRef} onScroll={handleScroll} className="h-96 overflow-auto rounded-md border bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-200">
                    {loading && entries.length === 0 ? (
                        <div className="flex items-center gap-2 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>
                    ) : orderedEntries.length === 0 ? (
                        <span className="text-zinc-400">{t('logs.empty')}</span>
                    ) : orderedEntries.map((entry) => (
                        <div key={entry.id} className="break-words">
                            <span className="mr-2 text-cyan-300">[{entry.source}]</span>{entry.line}
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-muted-foreground">{t('logs.entries', { count: visibleEntries.length })}</p>
        </div>
    );
}
