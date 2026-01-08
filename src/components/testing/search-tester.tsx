'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface ForumOption {
    id: string;
    name: string;
    baseUrl: string;
}

interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
    date?: string;
}

interface SearchTesterProps {
    forums: ForumOption[];
    onSearchResults?: (results: SearchResult[], forumId: string, query: string, searchMode: 'native' | 'google_site' | 'google_cse', searchId?: string, totalResults?: number) => void;
}

export function SearchTester({ forums, onSearchResults }: SearchTesterProps) {
    const [selectedForum, setSelectedForum] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [titleOnly, setTitleOnly] = useState<boolean>(false);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize default forum to the first configured one
    // when the component mounts or forums change and no forum is selected
    if (!selectedForum && forums && forums.length > 0) {
        setSelectedForum(forums[0].id);
    }

    const handleSearch = async () => {
        if (!selectedForum || !searchQuery.trim()) {
            setError('Selecciona un foro e introduce una búsqueda');
            return;
        }

        setIsSearching(true);
        setError(null);

        try {
            const response = await fetch('/api/testing/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    forumId: selectedForum,
                    query: searchQuery,
                    titleOnly,
                }),
            });

            const data = await response.json();

            if (data.success) {
                onSearchResults?.(data.results, selectedForum, searchQuery, data.searchMode || 'google_site', data.searchId, data.totalResults);
            } else {
                setError(data.error || 'Error al buscar');
            }
        } catch (err) {
            setError('Error de conexión al buscar');
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Búsqueda en Foro</CardTitle>
                <CardDescription>
                    Busca contenido en un foro configurado y visualiza los resultados
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Foro</label>
                        <Select value={selectedForum} onValueChange={setSelectedForum}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un foro" />
                            </SelectTrigger>
                            <SelectContent>
                                {forums.map((forum) => (
                                    <SelectItem key={forum.id} value={forum.id}>
                                        {forum.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Búsqueda</label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="Ej: Breaking Bad S01E01"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSearch();
                                }}
                                disabled={isSearching}
                            />
                            <Button onClick={handleSearch} disabled={isSearching || !selectedForum || !searchQuery.trim()}>
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4 mr-2" />
                                )}
                                Buscar
                            </Button>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    if (!selectedForum || !searchQuery.trim()) {
                                        setError('Selecciona un foro e introduce una búsqueda');
                                        return;
                                    }
                                    setIsSearching(true);
                                    setError(null);
                                    try {
                                        const response = await fetch('/api/testing/search', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                forumId: selectedForum,
                                                query: searchQuery,
                                                titleOnly,
                                                fetchAll: true,
                                                maxPages: 20,
                                            }),
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                            onSearchResults?.(data.results, selectedForum, searchQuery, data.searchMode || 'google_site', data.searchId, data.totalResults);
                                        } else {
                                            setError(data.error || 'Error al buscar');
                                        }
                                    } catch (err) {
                                        setError('Error de conexión al buscar');
                                        console.error('Search all error:', err);
                                    } finally {
                                        setIsSearching(false);
                                    }
                                }}
                                disabled={isSearching || !selectedForum || !searchQuery.trim()}
                            >
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4 mr-2" />
                                )}
                                Buscar todos
                            </Button>
                        </div>
                        <label className="text-sm font-medium flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                checked={titleOnly}
                                onChange={(e) => setTitleOnly(e.target.checked)}
                                className="h-4 w-4"
                            />
                            Buscar solo en el título
                        </label>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm">
                        {error}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
