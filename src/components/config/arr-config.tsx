'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, Settings, KeyRound, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';
import { useArrServices } from '@/hooks/use-api';

const createSchema = (t: ReturnType<typeof useI18n>['t']) => z.object({
    type: z.enum(['sonarr', 'radarr', 'lidarr', 'readarr']),
    name: z.string().min(1, 'Name required'),
});

type ArrForm = z.infer<ReturnType<typeof createSchema>>;

interface ArrConfigProps {
    language?: 'es' | 'en';
}

export function ArrConfig({ language = 'es' }: ArrConfigProps) {
    const { t } = useI18n(language);
    const schema = useMemo(() => createSchema(t), [t]);
    const { services, loading, createService, deleteService, toggleService, refetch } = useArrServices();
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState<string | null>(null);
    const form = useForm<ArrForm>({ resolver: zodResolver(schema), defaultValues: { type: 'sonarr', name: '' } });
    const editForm = useForm<ArrForm>({ resolver: zodResolver(schema), defaultValues: { type: 'sonarr', name: '' } });

    const submit = async (values: ArrForm) => {
        await createService(values);
        setOpen(false);
        form.reset({ type: 'sonarr', name: '' });
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            try {
                const el = document.createElement('textarea');
                el.value = text;
                el.setAttribute('readonly', '');
                el.style.position = 'absolute';
                el.style.left = '-9999px';
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
            } catch { }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t('arrConfig.title')}</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" /> {t('arrConfig.add')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('arrConfig.newTitle')}</DialogTitle>
                            <DialogDescription>{t('arrConfig.add')}</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                                <FormField name="type" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('arrConfig.type')}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('arrConfig.type')} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="sonarr">Sonarr</SelectItem>
                                                <SelectItem value="radarr">Radarr</SelectItem>
                                                <SelectItem value="lidarr">Lidarr</SelectItem>
                                                <SelectItem value="readarr">Readarr</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField name="name" control={form.control} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('arrConfig.name')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('arrConfig.namePlaceholder')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                                    <Button type="submit">{t('arrConfig.create')}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-2">
                {loading ? (
                    <p>{t('arrConfig.loading')}</p>
                ) : services.length === 0 ? (
                    <p className="text-muted-foreground">{t('arrConfig.empty')}</p>
                ) : (
                    services.map((s) => (
                        <div key={s.id} className="flex items-center justify-between border rounded-md p-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge variant={s.enabled ? 'secondary' : 'outline'}>{s.type}</Badge>
                                    <span className="font-medium">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <KeyRound className="h-3 w-3" />
                                    <span className="break-all">{s.apiKey}</span>
                                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => copy(s.apiKey)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => toggleService(s.id, !s.enabled)}>
                                    {s.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                </Button>
                                <Dialog open={editOpen === s.id} onOpenChange={(o) => setEditOpen(o ? s.id : null)}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                editForm.reset({ type: s.type, name: s.name });
                                                setEditOpen(s.id);
                                            }}
                                        >
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t('arrConfig.editTitle')}</DialogTitle>
                                        </DialogHeader>
                                        <Form {...editForm}>
                                            <form
                                                onSubmit={editForm.handleSubmit(async (values) => {
                                                    await fetch(`/api/config/arr/${s.id}`, {
                                                        method: 'PUT',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify(values),
                                                    });
                                                    setEditOpen(null);
                                                    await refetch();
                                                })}
                                                className="space-y-4"
                                            >
                                                <FormField name="type" control={editForm.control} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t('arrConfig.type')}</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="sonarr">Sonarr</SelectItem>
                                                                <SelectItem value="radarr">Radarr</SelectItem>
                                                                <SelectItem value="lidarr">Lidarr</SelectItem>
                                                                <SelectItem value="readarr">Readarr</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />

                                                <FormField name="name" control={editForm.control} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{t('arrConfig.name')}</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder={t('arrConfig.namePlaceholder')} {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />

                                                <DialogFooter>
                                                    <Button type="button" variant="outline" onClick={() => setEditOpen(null)}>{t('common.cancel')}</Button>
                                                    <Button type="submit">{t('arrConfig.save')}</Button>
                                                </DialogFooter>
                                            </form>
                                        </Form>
                                    </DialogContent>
                                </Dialog>
                                <Button variant="destructive" size="icon" onClick={() => deleteService(s.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
