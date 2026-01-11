'use client';

import { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Settings, Trash2, CheckCircle, XCircle, Clock, Loader2, Copy, Check } from 'lucide-react';

interface Forum {
    id: string;
    name: string;
    baseUrl: string;
    enabled: boolean;
    searchPath?: string | null;
    thankButtonSelector?: string | null;
    linksContainerSelector?: string | null;
    postTitleSelector?: string | null;
    credentials?: {
        username: string;
        password: string;
    } | null;
    flaresolverrSessionTTL?: number | null;
    torznabApiKey?: string; // API key for Torznab indexer
}

interface SessionInfo {
    sessionId: string;
    ageSeconds: number;
    expiresInSeconds: number;
    isExpired: boolean;
}

interface ForumWithSession extends Forum {
    sessionInfo?: SessionInfo | null;
    sessionLoading?: boolean;
}

interface ForumsTableProps {
    forums: Forum[];
    onEdit: (forum: Forum) => void;
    onDelete: (forumId: string) => Promise<void>;
    language?: 'es' | 'en';
}

import { useI18n } from '@/hooks/use-i18n';

export function ForumsTable({ forums, onEdit, onDelete, language = 'es' }: ForumsTableProps) {
    const [forumsWithSessions, setForumsWithSessions] = useState<ForumWithSession[]>(
        forums.map((f) => ({ ...f, sessionLoading: true }))
    );
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { t } = useI18n(language);

    useEffect(() => {
        // Fetch session info for all forums
        const fetchSessions = async () => {
            const updated = await Promise.all(
                forums.map(async (forum) => {
                    try {
                        const response = await fetch(`/api/config/forums/${forum.id}/session`);
                        if (response.ok) {
                            const data = await response.json();
                            return {
                                ...forum,
                                sessionInfo: data.data?.session || null,
                                sessionLoading: false,
                            };
                        }
                    } catch (err) {
                        console.error(`Failed to fetch session for ${forum.name}:`, err);
                    }
                    return { ...forum, sessionInfo: null, sessionLoading: false };
                })
            );
            setForumsWithSessions(updated);
        };

        fetchSessions();
        // Refresh every 30 seconds
        const interval = setInterval(fetchSessions, 30000);
        return () => clearInterval(interval);
    }, [forums]);

    const handleDelete = async (forumId: string) => {
        setDeletingId(forumId);
        try {
            await onDelete(forumId);
        } finally {
            setDeletingId(null);
        }
    };

    const handleCopyFeed = (forum: Forum) => {
        if (!forum.torznabApiKey) return;
        
        // Copy full Newznab URL
        const feedUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/arr?apikey=${forum.torznabApiKey}`;
        navigator.clipboard.writeText(feedUrl);
        
        setCopiedId(forum.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDuration = (seconds: number): string => {
        if (seconds < 0) return t('forumsTable.expired');
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    const formatTTL = (ttlMs: number | null | undefined): string => {
        if (!ttlMs) return t('forumsTable.defaultTtl');
        const minutes = Math.round(ttlMs / 60000);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    return (
        <TooltipProvider>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('forumsTable.forum')}</TableHead>
                            <TableHead>{t('forumsTable.baseUrl')}</TableHead>
                            <TableHead>{t('forumsTable.status')}</TableHead>
                            <TableHead>{t('forumsTable.session')}</TableHead>
                            <TableHead>{t('forumsTable.duration')}</TableHead>
                            <TableHead>Torznab Feed</TableHead>
                            <TableHead className="text-right">{t('forumsTable.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {forumsWithSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    {t('forumsTable.noForums')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            forumsWithSessions.map((forum) => (
                                <TableRow key={forum.id}>
                                    <TableCell className="font-medium">{forum.name}</TableCell>
                                    <TableCell>
                                        <a
                                            href={forum.baseUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            {forum.baseUrl}
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={forum.enabled ? 'default' : 'secondary'}>
                                            {forum.enabled ? (
                                                <>
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    {t('forumsTable.active')}
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    {t('forumsTable.inactive')}
                                                </>
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {forum.sessionLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {t('forumsTable.loading')}
                                            </div>
                                        ) : forum.sessionInfo ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            variant={forum.sessionInfo.isExpired ? 'destructive' : 'outline'}
                                                        >
                                                            {forum.sessionInfo.isExpired ? (
                                                                <>
                                                                    <XCircle className="h-3 w-3 mr-1" />
                                                                    {t('forumsTable.expired')}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Clock className="h-3 w-3 mr-1" />
                                                                    {formatDuration(forum.sessionInfo.expiresInSeconds)}
                                                                </>
                                                            )}
                                                        </Badge>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="text-xs space-y-1">
                                                        <p>
                                                            <strong>{t('forumsTable.sessionId')}:</strong> {forum.sessionInfo.sessionId.slice(0, 8)}...
                                                        </p>
                                                        <p>
                                                            <strong>{t('forumsTable.age')}:</strong> {formatDuration(forum.sessionInfo.ageSeconds)}
                                                        </p>
                                                        <p>
                                                            <strong>{t('forumsTable.expiresIn')}:</strong>{' '}
                                                            {formatDuration(forum.sessionInfo.expiresInSeconds)}
                                                        </p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">{t('forumsTable.noSession')}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{formatTTL(forum.flaresolverrSessionTTL)}</span>
                                    </TableCell>
                                    <TableCell>
                                        {forum.torznabApiKey && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCopyFeed(forum)}
                                                        className="text-xs"
                                                    >
                                                        {copiedId === forum.id ? (
                                                            <>
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Copied
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="h-3 w-3 mr-1" />
                                                                Copy Newznab URL
                                                            </>
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs">
                                                    <div className="text-xs">
                                                        <p className="font-semibold mb-1">Newznab Feed URL:</p>
                                                        <code className="break-all">
                                                            {`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/arr?apikey=${forum.torznabApiKey}`}
                                                        </code>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => onEdit(forum)}
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>{t('forumsTable.editConfiguration')}</TooltipContent>
                                            </Tooltip>

                                            <AlertDialog>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="destructive"
                                                                size="icon"
                                                                disabled={deletingId === forum.id}
                                                            >
                                                                {deletingId === forum.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent>{t('forumsTable.deleteForumAction')}</TooltipContent>
                                                </Tooltip>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('forumsTable.confirmDeleteForum')}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t('forumsTable.undoNotPossible')} "{forum.name}"
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(forum.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            {t('common.delete')}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    );
}
