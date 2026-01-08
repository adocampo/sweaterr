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
import { Settings, Trash2, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

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
}

export function ForumsTable({ forums, onEdit, onDelete }: ForumsTableProps) {
    const [forumsWithSessions, setForumsWithSessions] = useState<ForumWithSession[]>(
        forums.map((f) => ({ ...f, sessionLoading: true }))
    );
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

    const formatDuration = (seconds: number): string => {
        if (seconds < 0) return 'Expirada';
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    const formatTTL = (ttlMs: number | null | undefined): string => {
        if (!ttlMs) return '30 min'; // Default
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
                            <TableHead>Foro</TableHead>
                            <TableHead>URL Base</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Sesión FlareSolverr</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {forumsWithSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    No hay foros configurados
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
                                                    Activo
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    Inactivo
                                                </>
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {forum.sessionLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Cargando...
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
                                                                    Expirada
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
                                                            <strong>ID:</strong> {forum.sessionInfo.sessionId.slice(0, 8)}...
                                                        </p>
                                                        <p>
                                                            <strong>Edad:</strong> {formatDuration(forum.sessionInfo.ageSeconds)}
                                                        </p>
                                                        <p>
                                                            <strong>Expira en:</strong>{' '}
                                                            {formatDuration(forum.sessionInfo.expiresInSeconds)}
                                                        </p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">Sin sesión</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{formatTTL(forum.flaresolverrSessionTTL)}</span>
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
                                                <TooltipContent>Editar configuración</TooltipContent>
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
                                                    <TooltipContent>Eliminar foro</TooltipContent>
                                                </Tooltip>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar foro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Se eliminará el foro "{forum.name}"
                                                            de forma permanente.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(forum.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Eliminar
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
