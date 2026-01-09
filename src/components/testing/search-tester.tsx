'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
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
    language?: 'es' | 'en';
}

export function SearchTester({ forums, onSearchResults, language = 'es' }: SearchTesterProps) {
    const { t } = useI18n(language);
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
            setError(t('testing.errorSelectForum'));
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
                setError(data.error || t('testing.searchError'));
            }
        } catch (err) {
            setError(t('testing.connectionError'));
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('testing.searchInForum')}</CardTitle>
                <CardDescription>
                    {t('testing.searchDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('testing.forum')}</label>
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
                        <label className="text-sm font-medium">{t('testing.search')}</label>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder={t('testing.searchPlaceholder')}
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
                                {t('testing.search')}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    if (!selectedForum || !searchQuery.trim()) {
                                        setError(t('testing.errorSelectForum'));
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
                                            setError(data.error || t('testing.searchError'));
                                        }
                                    } catch (err) {
                                        setError(t('testing.connectionError'));
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
                                {t('testing.searchAll')}
                            </Button>
                        </div>
                        <label className="text-sm font-medium flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                checked={titleOnly}
                                onChange={(e) => setTitleOnly(e.target.checked)}
                                className="h-4 w-4"
                            />
                            {t('testing.titleOnly')}
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
