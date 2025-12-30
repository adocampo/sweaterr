'use client';

import { useState } from 'react';
import { ExternalLink, Download, Loader2, Copy, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface ResultViewerProps {
    results: SearchResult[];
    forumId: string;
    searchQuery: string;
    onExtractLinks?: (links: ExtractedLink[], postUrl: string) => void;
}

export function ResultViewer({ results, forumId, searchQuery, onExtractLinks }: ResultViewerProps) {
    const [selectedPost, setSelectedPost] = useState<string | null>(null);
    const [extractingLinks, setExtractingLinks] = useState(false);
    const [extractedByPost, setExtractedByPost] = useState<Record<string, ExtractedLink[]>>({});
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});
    const [sendingToJd, setSendingToJd] = useState<Record<string, boolean>>({});
    const [sendErrors, setSendErrors] = useState<Record<string, string | null>>({});
    const [sendSuccess, setSendSuccess] = useState<Record<string, boolean>>({});

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

        try {
            const response = await fetch('/api/testing/jdownloader/add-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    links: links.map(l => l.url),
                    packageName,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'No se pudieron enviar los enlaces');
            }

            setSendSuccess(prev => ({ ...prev, [postUrl]: true }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error desconocido enviando a JDownloader';
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

    if (results.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Resultados de Búsqueda</CardTitle>
                    <CardDescription>
                        Posts encontrados en el foro
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        Ejecuta una búsqueda para ver resultados
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Search Results */}
            <Card>
                <CardHeader>
                    <CardTitle>Resultados de Búsqueda</CardTitle>
                    <CardDescription>
                        {results.length} resultado{results.length !== 1 ? 's' : ''} para &quot;{searchQuery}&quot;
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {results.map((result, index) => {
                            const postLinks = extractedByPost[result.url] || [];
                            return (
                                <div
                                    key={index}
                                    className={`border rounded-lg p-4 hover:bg-accent transition-colors ${selectedPost === result.url ? 'bg-accent' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-1">
                                            <h3 className="font-medium leading-tight">
                                                {titles[result.url] || result.title}
                                            </h3>
                                            {!titles[result.url] && /\.\.\./.test(result.title) && (
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => enrichTitle(result.url, result.title)} disabled={!!enriching[result.url]}>
                                                        {enriching[result.url] ? (
                                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                        ) : null}
                                                        Completar título
                                                    </Button>
                                                </div>
                                            )}
                                            {result.snippet && (
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    {result.snippet}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 hover:text-primary"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Abrir en nueva pestaña
                                                </a>
                                                {result.date && <span>• {result.date}</span>}
                                            </div>
                                        </div>
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
                                            Extraer Enlaces
                                        </Button>
                                    </div>

                                    {postLinks.length > 0 && (
                                        <div className="mt-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs text-muted-foreground">
                                                    {postLinks.length} enlace{postLinks.length !== 1 ? 's' : ''} de descarga directa encontrado{postLinks.length !== 1 ? 's' : ''}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={sendingToJd[result.url]}
                                                    onClick={() => sendToJDownloader(result.url, postLinks, titles[result.url] || result.title)}
                                                >
                                                    {sendingToJd[result.url] ? (
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Send className="h-4 w-4 mr-2" />
                                                    )}
                                                    Enviar a JDownloader
                                                </Button>
                                            </div>

                                            {sendSuccess[result.url] && (
                                                <div className="text-xs text-green-500">Enlaces enviados a JDownloader</div>
                                            )}
                                            {sendErrors[result.url] && (
                                                <div className="text-xs text-red-500">{sendErrors[result.url]}</div>
                                            )}

                                            <div className="space-y-3">
                                                {Object.entries(groupLinksByHosting(postLinks)).map(([hosting, links]) => (
                                                    <div key={hosting} className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">{hosting}</Badge>
                                                            <span className="text-sm text-muted-foreground">
                                                                {links.length} enlace{links.length !== 1 ? 's' : ''}
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
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
