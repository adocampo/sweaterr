'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Download, Loader2, Copy, Check, Send, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBulkTitles } from '@/hooks/use-api';

interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
    date?: string;
}

interface ExtractedLink {
    url: string;
    hosting: string;
    filename?: string;
}

interface MediaMetadata {
    type: 'series' | 'movie' | 'unknown';
    title?: string | null;
    cleanTitle?: string | null;
    year?: number | null;
    season?: number | null;
    quality?: string | null;
    audioLanguages?: string[];
    subtitleLanguages?: string[];
    episodesAvailable?: number | null;
    episodesTotal?: number | null;
    genres?: string[];
    size?: string | null;
}

interface MetadataResult {
    url: string;
    rawTitle?: string;  // Original forum post title for verification
    metadata?: MediaMetadata;
    isSeasonPack?: boolean; // True if [X/Y] where X == Y
    error?: string;
}

interface ResultViewerProps {
    results: SearchResult[];
    forumId: string;
    searchQuery: string;
    searchMode?: 'native' | 'google_site' | 'google_cse';
    totalResults?: number;
    onExtractLinks?: (links: ExtractedLink[], postUrl: string) => void;
    onLoadMore?: () => Promise<void> | void;
    onLoadAll?: () => Promise<void> | void;
    loadingMore?: boolean;
    language?: 'es' | 'en';
}

export function ResultViewer({ results, forumId, searchQuery, searchMode, totalResults, onExtractLinks, onLoadMore, onLoadAll, loadingMore, language = 'es' }: ResultViewerProps) {
    const { t } = useI18n(language);
    const [selectedPost, setSelectedPost] = useState<string | null>(null);
    const [extractingLinks, setExtractingLinks] = useState(false);
    const [extractedByPost, setExtractedByPost] = useState<Record<string, ExtractedLink[]>>({});
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});
    const [sendingToJd, setSendingToJd] = useState<Record<string, boolean>>({});
    const [sendErrors, setSendErrors] = useState<Record<string, string | null>>({});
    const [sendSuccess, setSendSuccess] = useState<Record<string, boolean>>({});
    const [metadataByPost, setMetadataByPost] = useState<Record<string, MediaMetadata>>({});
    const [seasonPacksByPost, setSeasonPacksByPost] = useState<Record<string, boolean>>({});
    const [metadataErrors, setMetadataErrors] = useState<Record<string, string>>({});
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [metadataTime, setMetadataTime] = useState<number | null>(null);
    const [metadataMode, setMetadataMode] = useState<string | null>(null);
    const [totalMetadataResults, setTotalMetadataResults] = useState<number | null>(null);
    const [visibleTypes, setVisibleTypes] = useState<Set<'series' | 'movie' | 'unknown'>>(
        new Set(['series', 'movie', 'unknown'])
    );
    const [expandedRawTitles, setExpandedRawTitles] = useState<Set<string>>(new Set());
    const [rawTitlesByPost, setRawTitlesByPost] = useState<Record<string, string>>({});
    const { loading: bulkLoading, resolveTitles } = useBulkTitles();
    const [bulkError, setBulkError] = useState<string | null>(null);

    // Toggle visibility of a specific type
    const toggleType = (type: 'series' | 'movie' | 'unknown') => {
        const newSet = new Set(visibleTypes);
        if (newSet.has(type)) {
            newSet.delete(type);
        } else {
            newSet.add(type);
        }
        setVisibleTypes(newSet);
    };

    // Toggle raw title visibility
    const toggleRawTitle = (url: string) => {
        const newSet = new Set(expandedRawTitles);
        if (newSet.has(url)) {
            newSet.delete(url);
        } else {
            newSet.add(url);
        }
        setExpandedRawTitles(newSet);
    };

    // Filter results based on visible types
    const filteredResults = results.filter(result => {
        const meta = metadataByPost[result.url];
        if (!meta) return true; // Show if metadata not yet loaded
        return visibleTypes.has(meta.type);
    });

    // Count results by type
    const typeCount = {
        series: 0,
        movie: 0,
        unknown: 0,
    };
    results.forEach(result => {
        const meta = metadataByPost[result.url];
        if (meta) {
            typeCount[meta.type]++;
        }
    });

    const formatResultsSummary = () => {
        if (totalResults) {
            if (results.length < totalResults) {
                return t('testing.showingResultsOfTotal', {
                    count: results.length,
                    total: totalResults,
                    query: searchQuery
                });
            }
            return t('testing.showingAllResults', { total: totalResults, query: searchQuery });
        }
        return t('testing.showingResults', {
            count: results.length,
            plural: results.length !== 1 ? 's' : '',
            query: searchQuery
        });
    };

    const handleExtractLinks = async (postUrl: string) => {
        setSelectedPost(postUrl);
        setExtractingLinks(true);
        // Do not clear other posts' links; each post keeps its own links

        try {
            const response = await fetch('/api/extract-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    forumId,
                    postUrl,
                }),
            });

            const data = await response.json();

            console.log('[ResultViewer] Extract response:', data);

            if (data.success) {
                // Normalize strings to plain URLs and convert to ExtractedLink models
                const toPlainUrl = (input: string): string => {
                    // Find first http(s) occurrence and return it
                    const match = input.match(/https?:\/\/[^\s"']+/i);
                    return match ? match[0] : input.trim();
                };

                const links: ExtractedLink[] = (data.links || [])
                    .map((raw: string) => toPlainUrl(raw))
                    .filter((u: string) => /^https?:\/\//.test(u))
                    .map((u: string) => {
                        let hosting = 'unknown';
                        try {
                            const urlObj = new URL(u);
                            hosting = urlObj.hostname.replace('www.', '');
                        } catch {
                            // ignore parsing errors
                        }
                        return {
                            url: u,
                            hosting,
                            filename: u.split('/').pop(),
                        } as ExtractedLink;
                    });

                console.log('[ResultViewer] Extracted links:', links);
                setExtractedByPost(prev => ({ ...prev, [postUrl]: links }));
                console.log('[ResultViewer] State updated for post', postUrl, 'count:', links.length);
                onExtractLinks?.(links, postUrl);
            } else {
                console.error('Error extracting links:', data.error);
            }
        } catch (err) {
            console.error('Error extracting links:', err);
        } finally {
            setExtractingLinks(false);
        }
    };

    const copyToClipboard = async (url: string) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else if (typeof document !== 'undefined') {
                const textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            } else {
                throw new Error('Clipboard API is not available');
            }
            setCopiedUrl(url);
            setTimeout(() => setCopiedUrl(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const sendToJDownloader = async (postUrl: string, links: ExtractedLink[], packageName?: string) => {
        if (!links || links.length === 0) return;
        setSendingToJd(prev => ({ ...prev, [postUrl]: true }));
        setSendErrors(prev => ({ ...prev, [postUrl]: null }));
        setSendSuccess(prev => ({ ...prev, [postUrl]: false }));

        const resolvedPackage = packageName || metadataByPost[postUrl]?.title || titles[postUrl] || postUrl;

        try {
            const response = await fetch('/api/testing/jdownloader/add-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    links: links.map(l => l.url),
                    packageName: resolvedPackage,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || t('testing.sendLinksError'));
            }

            setSendSuccess(prev => ({ ...prev, [postUrl]: true }));
        } catch (err) {
            const message = err instanceof Error ? err.message : t('testing.sendLinksUnknownError');
            setSendErrors(prev => ({ ...prev, [postUrl]: message }));
        } finally {
            setSendingToJd(prev => ({ ...prev, [postUrl]: false }));
        }
    };

    const enrichTitle = async (postUrl: string, currentTitle: string) => {
        // Skip if already enriched or currently enriching
        if (titles[postUrl] && titles[postUrl].length > 0) return;
        if (enriching[postUrl]) return;
        // Only try when ellipsis present
        if (!/\.\.\./.test(currentTitle)) return;
        setEnriching(prev => ({ ...prev, [postUrl]: true }));
        try {
            const resp = await fetch('/api/testing/title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forumId, postUrl }),
            });
            const data = await resp.json();
            if (data.success && data.title) {
                setTitles(prev => ({ ...prev, [postUrl]: data.title }));
            } else if (!data.success && data.error) {
                console.warn('[ResultViewer] Title fetch failed:', data.error);
            }
        } catch (err) {
            // ignore errors
        } finally {
            setEnriching(prev => ({ ...prev, [postUrl]: false }));
        }
    };

    const groupLinksByHosting = (links: ExtractedLink[]) => {
        const grouped: Record<string, ExtractedLink[]> = {};
        links.forEach(link => {
            if (!grouped[link.hosting]) {
                grouped[link.hosting] = [];
            }
            grouped[link.hosting].push(link);
        });
        return grouped;
    };

    const handleBulkTitles = async () => {
        setBulkError(null);
        try {
            const postUrls = results.map(r => r.url);
            const data = await resolveTitles(forumId, postUrls);
            if (data?.results) {
                const updated: Record<string, string> = {};
                data.results.forEach((item: any) => {
                    if (item.title) {
                        updated[item.url] = item.title as string;
                    }
                });
                if (Object.keys(updated).length > 0) {
                    setTitles(prev => ({ ...prev, ...updated }));
                }
                if ((data.totalErrors ?? 0) > 0) {
                    setBulkError(t('testing.bulkTitleErrors', { count: data.totalErrors }));
                }
            }
        } catch (err) {
            setBulkError(err instanceof Error ? err.message : t('testing.resolveTitlesError'));
        }
    };

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setMetadataByPost({});
            setSeasonPacksByPost({});
            setMetadataErrors({});
            if (!forumId || results.length === 0) {
                setMetadataLoading(false);
                return;
            }

            setMetadataLoading(true);
            const metaStartTime = Date.now();
            try {
                const isNative = searchMode === 'native';
                const body = isNative
                    ? {
                        forumId,
                        directTitles: results.map((r) => ({
                            url: r.url,
                            title: r.title,
                            snippet: r.snippet || '',
                        })),
                        searchQuery,
                    }
                    : {
                        forumId,
                        postUrls: results.map((r) => r.url),
                        searchQuery,
                    };

                const response = await fetch('/api/testing/metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const data = await response.json();
                const metaEndTime = Date.now();
                const metaElapsed = metaEndTime - metaStartTime;
                if (cancelled) return;

                if (data.success && data.data?.results) {
                    const metaMap: Record<string, MediaMetadata> = {};
                    const seasonPackMap: Record<string, boolean> = {};
                    const errorMap: Record<string, string> = {};
                    const rawTitleMap: Record<string, string> = {};
                    (data.data.results as MetadataResult[]).forEach((item) => {
                        if (item.metadata) metaMap[item.url] = item.metadata;
                        if (item.isSeasonPack !== undefined) seasonPackMap[item.url] = item.isSeasonPack;
                        if (item.error) errorMap[item.url] = item.error;
                        if (item.rawTitle) rawTitleMap[item.url] = item.rawTitle;
                    });
                    setMetadataByPost(metaMap);
                    setSeasonPacksByPost(seasonPackMap);
                    setMetadataErrors(errorMap);
                    setRawTitlesByPost(rawTitleMap);
                    setMetadataTime(metaElapsed);
                    setMetadataMode(data.data?.mode || null);
                    setTotalMetadataResults(data.data?.totalResults || null);
                } else {
                    setMetadataErrors({ general: data.error || t('testing.metadataFetchError') });
                }
            } catch (err: any) {
                if (cancelled) return;
                setMetadataErrors({ general: err?.message || t('testing.metadataFetchUnknownError') });
            } finally {
                if (!cancelled) setMetadataLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [forumId, results, searchQuery, searchMode]);

    if (results.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('testing.results')}</CardTitle>
                    <CardDescription>
                        {t('testing.postsFoundDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        {t('testing.executeSearchPrompt')}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{t('testing.results')}</CardTitle>
                    <CardDescription>
                        {formatResultsSummary()}
                        {metadataTime !== null && (
                            <span className="ml-2 text-xs">
                                {t('testing.metadataTime', { ms: metadataTime })}
                                {metadataMode && <span className="ml-1">{t('testing.metadataMode', { mode: metadataMode })}</span>}
                                {totalMetadataResults !== null && totalMetadataResults !== results.length && (
                                    <span className="ml-1">{t('testing.metadataTotalProcessed', { count: totalMetadataResults })}</span>
                                )}
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                            {t('testing.batchResolveNote')}
                        </div>
                        <div className="flex items-center gap-2">
                            {metadataLoading && (
                                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {t('testing.metadataAnalyzing')}
                                </span>
                            )}
                            <Button variant="outline" size="sm" onClick={handleBulkTitles} disabled={bulkLoading}>
                                {bulkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                {t('testing.resolveTitles')}
                            </Button>
                            {onLoadMore && (
                                <Button variant="outline" size="sm" onClick={() => onLoadMore()} disabled={!!loadingMore || (totalResults ? results.length >= totalResults : false)}>
                                    {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    {t('testing.loadMore')}
                                    {totalResults && results.length < totalResults && ` ${t('testing.loadMoreProgress', { current: results.length, total: totalResults })}`}
                                </Button>
                            )}
                            {onLoadAll && (
                                <Button variant="outline" size="sm" onClick={() => onLoadAll()} disabled={!!loadingMore || (totalResults ? results.length >= totalResults : false)}>
                                    {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    {t('testing.loadAll')}
                                    {totalResults && results.length < totalResults && ` ${t('testing.loadAllRemaining', { remaining: totalResults - results.length })}`}
                                </Button>
                            )}
                        </div>
                    </div>

                    {bulkError && (
                        <div className="text-sm text-red-600 dark:text-red-400">{bulkError}</div>
                    )}
                    {metadataErrors.general && (
                        <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {metadataErrors.general}
                        </div>
                    )}

                    {/* Type filter checkboxes */}
                    <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/30 rounded-md">
                        <span className="text-sm font-medium">{t('testing.filterByType')}</span>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="checkbox"
                                checked={visibleTypes.has('series')}
                                onChange={() => toggleType('series')}
                                className="rounded"
                            />
                            <span>{t('testing.typeSeries')} ({typeCount.series})</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="checkbox"
                                checked={visibleTypes.has('movie')}
                                onChange={() => toggleType('movie')}
                                className="rounded"
                            />
                            <span>{t('testing.typeMovie')} ({typeCount.movie})</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                                type="checkbox"
                                checked={visibleTypes.has('unknown')}
                                onChange={() => toggleType('unknown')}
                                className="rounded"
                            />
                            <span>{t('testing.typeUnknown')} ({typeCount.unknown})</span>
                        </label>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {t('testing.showingFilteredResults', { 
                                shown: filteredResults.length, 
                                total: results.length 
                            })}
                        </span>
                    </div>

                    <div className="overflow-x-auto border rounded-md">
                        <table className="min-w-full text-sm">
                            <thead className="bg-muted/60">
                                <tr className="text-left">
                                    <th className="px-3 py-2">{t('testing.tableTitle')}</th>
                                    <th className="px-3 py-2">{t('testing.tableType')}</th>
                                    <th className="px-3 py-2">{t('testing.tableYear')}</th>
                                    <th className="px-3 py-2">{t('testing.tableSeason')}</th>
                                    <th className="px-3 py-2">{t('testing.tableEpisodes')}</th>
                                    <th className="px-3 py-2">{t('testing.tableSeasonPack')}</th>
                                    <th className="px-3 py-2">{t('testing.tableQuality')}</th>
                                    <th className="px-3 py-2">{t('testing.tableAudioSubs')}</th>
                                    <th className="px-3 py-2">{t('testing.tableGenre')}</th>
                                    <th className="px-3 py-2">{t('testing.tableSize')}</th>
                                    <th className="px-3 py-2 text-right">{t('testing.tableActions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((result, index) => {
                                    const postLinks = extractedByPost[result.url] || [];
                                    const meta = metadataByPost[result.url];
                                    const isSeasonPack = seasonPacksByPost[result.url];
                                    const rawTitle = rawTitlesByPost[result.url];
                                    const isExpanded = expandedRawTitles.has(result.url);
                                    const displayTitle = meta?.cleanTitle || meta?.title || titles[result.url] || result.title;
                                    const typeLabel = meta?.type === 'series'
                                        ? t('testing.typeSeries')
                                        : meta?.type === 'movie'
                                            ? t('testing.typeMovie')
                                            : t('testing.typeUnknown');
                                    const episodesLabel = meta?.type === 'series'
                                        ? (meta?.episodesAvailable ?? meta?.episodesTotal
                                            ? `${meta?.episodesAvailable ?? '—'}/${meta?.episodesTotal ?? '—'}`
                                            : '—')
                                        : '—';
                                    const seasonLabel = meta?.type === 'series' && meta?.season
                                        ? t('testing.seasonLabel', { season: meta.season })
                                        : '—';
                                    const qualityLabel = meta?.quality || '—';
                                    const yearLabel = meta?.year || result.date || '—';
                                    const audioLabel = meta?.audioLanguages?.length ? meta.audioLanguages.join(', ') : '—';
                                    const subsLabel = meta?.subtitleLanguages?.length ? meta.subtitleLanguages.join(', ') : '—';
                                    const genresLabel = meta?.genres?.length ? meta.genres.join(', ') : '—';
                                    const sizeLabel = meta?.size || '—';
                                    const metaError = metadataErrors[result.url];

                                    return (
                                        <>
                                            <tr key={`${index}-main`} className={`border-b ${selectedPost === result.url ? 'bg-accent/40' : ''}`}>
                                                <td className="px-3 py-2 align-top">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {rawTitle && (
                                                                <button
                                                                    onClick={() => toggleRawTitle(result.url)}
                                                                    className="text-muted-foreground hover:text-primary transition-colors p-0 h-5 w-5 flex items-center justify-center"
                                                                    title={isExpanded ? 'Hide raw title' : 'Show raw title'}
                                                                >
                                                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                            )}
                                                            <span className="font-medium leading-tight">{displayTitle}</span>
                                                            <a
                                                                href={result.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                                {t('testing.open')}
                                                            </a>
                                                        </div>
                                                        {result.snippet && (
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                                                        )}
                                                        {metaError && (
                                                            <div className="text-xs text-red-500 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" />
                                                                {metaError}
                                                            </div>
                                                        )}
                                                        {!meta?.title && !titles[result.url] && /\.\.\./.test(result.title) && (
                                                            <Button size="sm" variant="ghost" onClick={() => enrichTitle(result.url, result.title)} disabled={!!enriching[result.url]} className="h-7 px-2">
                                                                {enriching[result.url] ? (
                                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                                ) : null}
                                                                {t('testing.completeTitle')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 align-top">{typeLabel}</td>
                                                <td className="px-3 py-2 align-top">{yearLabel}</td>
                                                <td className="px-3 py-2 align-top">{seasonLabel}</td>
                                                <td className="px-3 py-2 align-top">{episodesLabel}</td>
                                                <td className="px-3 py-2 align-top text-center">
                                                    {isSeasonPack !== undefined ? (
                                                        <span className={isSeasonPack ? "text-green-600 font-bold" : "text-gray-400"}>
                                                            {isSeasonPack ? "✓" : "✗"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 align-top">{qualityLabel}</td>
                                                <td className="px-3 py-2 align-top">
                                                    <div className="space-y-1">
                                                        <div className="text-xs">{t('testing.audioLabel')}: {audioLabel}</div>
                                                        <div className="text-xs">{t('testing.subsLabel')}: {subsLabel}</div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 align-top">{genresLabel}</td>
                                                <td className="px-3 py-2 align-top">{sizeLabel}</td>
                                                <td className="px-3 py-2 align-top">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleExtractLinks(result.url)}
                                                            disabled={extractingLinks && selectedPost === result.url}
                                                        >
                                                            {extractingLinks && selectedPost === result.url ? (
                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Download className="h-4 w-4 mr-2" />
                                                            )}
                                                            {t('testing.extractLinks')}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            disabled={sendingToJd[result.url] || postLinks.length === 0}
                                                            onClick={() => sendToJDownloader(result.url, postLinks, meta?.title || titles[result.url] || result.title)}
                                                        >
                                                            {sendingToJd[result.url] ? (
                                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Send className="h-4 w-4 mr-2" />
                                                            )}
                                                            {t('testing.send')}
                                                        </Button>
                                                    </div>
                                                    {sendSuccess[result.url] && (
                                                        <div className="text-[11px] text-green-600 text-right mt-1">{t('testing.sentToJDownloader')}</div>
                                                    )}
                                                    {sendErrors[result.url] && (
                                                        <div className="text-[11px] text-red-600 text-right mt-1">{sendErrors[result.url]}</div>
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && rawTitle && (
                                                <tr key={`${index}-raw`} className="border-b bg-muted/30">
                                                    <td colSpan={10} className="px-3 py-2">
                                                        <div className="text-xs text-muted-foreground">
                                                            <span className="font-semibold">Original title:</span> {rawTitle}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {Object.entries(metadataErrors).filter(([key]) => key !== 'general').length > 0 && (
                        <div className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {t('testing.someMetadataMissing')}
                        </div>
                    )}

                    {Object.entries(extractedByPost).length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium mt-2">{t('testing.extractedLinks')}</h4>
                            {Object.entries(extractedByPost).map(([postUrl, postLinks]) => (
                                <div key={postUrl} className="border rounded-md p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="font-medium text-sm">{metadataByPost[postUrl]?.title || titles[postUrl] || postUrl}</div>
                                            <div className="text-xs text-muted-foreground">{t('testing.linksFound', { count: postLinks.length, plural: postLinks.length !== 1 ? 's' : '' })}</div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            disabled={sendingToJd[postUrl]}
                                            onClick={() => sendToJDownloader(postUrl, postLinks, metadataByPost[postUrl]?.title || titles[postUrl] || postUrl)}
                                        >
                                            {sendingToJd[postUrl] ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4 mr-2" />
                                            )}
                                            {t('testing.sendToJDownloader')}
                                        </Button>
                                    </div>
                                    {sendSuccess[postUrl] && (
                                        <div className="text-xs text-green-500">{t('testing.linksSentToJDownloader')}</div>
                                    )}
                                    {sendErrors[postUrl] && (
                                        <div className="text-xs text-red-500">{sendErrors[postUrl]}</div>
                                    )}
                                    <div className="space-y-3">
                                        {Object.entries(groupLinksByHosting(postLinks)).map(([hosting, links]) => (
                                            <div key={hosting} className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">{hosting}</Badge>
                                                    <span className="text-sm text-muted-foreground">
                                                        {t('testing.linksCount', { count: links.length, plural: links.length !== 1 ? 's' : '' })}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {links.map((link, linkIndex) => (
                                                        <div
                                                            key={linkIndex}
                                                            className="flex items-center gap-2 bg-muted/50 rounded-md p-2"
                                                        >
                                                            <code className="flex-1 text-sm truncate">{link.url}</code>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => copyToClipboard(link.url)}
                                                            >
                                                                {copiedUrl === link.url ? (
                                                                    <Check className="h-4 w-4 text-green-500" />
                                                                ) : (
                                                                    <Copy className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
