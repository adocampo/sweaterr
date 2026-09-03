"use client";

import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface UserRecord {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    enabled: boolean;
}

interface UserManagementProps {
    language?: 'es' | 'en';
}

export function UserManagement({ language = 'es' }: UserManagementProps) {
    const { t } = useI18n(language);
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' as 'admin' | 'user' });
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState({ username: '', email: '', role: 'user' as 'admin' | 'user', password: '' });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/auth/users');
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Error');
                return;
            }
            setUsers(data.users || []);
            setError(null);
        } catch (err) {
            console.error('Failed to load users', err);
            setError('No se pudo cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreate = async () => {
        if (!form.username || form.password.length < 8) {
            setError('Usuario y contraseña (>=8) son requeridos');
            return;
        }
        try {
            setSaving(true);
            const res = await fetch('/api/auth/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Error');
                return;
            }
            setForm({ username: '', email: '', password: '', role: 'user' });
            setIsCreateOpen(false);
            await loadUsers();
        } catch (err) {
            console.error('Failed to create user', err);
            setError('No se pudo crear usuario');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (user: UserRecord) => {
        setEditingId(user.id);
        setEditingData({ username: user.username || '', email: user.email || '', role: user.role, password: '' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingData({ username: '', email: '', role: 'user', password: '' });
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        if (!editingData.username) {
            setError('Usuario requerido');
            return;
        }
        try {
            setSaving(true);
            const res = await fetch(`/api/auth/users/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingData),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Error');
                return;
            }
            cancelEdit();
            await loadUsers();
        } catch (err) {
            console.error('Failed to update user', err);
            setError('No se pudo actualizar usuario');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setSaving(true);
            const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Error');
                return;
            }
            await loadUsers();
        } catch (err) {
            console.error('Failed to delete user', err);
            setError('No se pudo eliminar usuario');
        } finally {
            setSaving(false);
        }
    };

    const toggleUser = async (user: UserRecord) => {
        try {
            setSaving(true);
            const res = await fetch(`/api/auth/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !user.enabled }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Error');
                return;
            }
            await loadUsers();
        } catch (err) {
            console.error('Failed to toggle user', err);
            setError('No se pudo actualizar usuario');
        } finally {
            setSaving(false);
        }
    };

    const isLastEnabledAdmin = (user: UserRecord) => (
        user.role === 'admin'
        && user.enabled
        && users.filter((candidate) => candidate.role === 'admin' && candidate.enabled).length === 1
    );

    return (
        <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between">
                <h4 className="font-semibold">{t('config.users')}</h4>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('config.addUser')}
                </Button>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t('config.addUser')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input placeholder={t('config.username')} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                        <Input placeholder={t('auth.email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                        <Input placeholder={t('config.password')} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                        <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as 'admin' | 'user' })}>
                            <SelectTrigger><SelectValue placeholder={t('config.role')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">{t('config.user')}</SelectItem>
                                <SelectItem value="admin">{t('config.admin')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleCreate} disabled={saving}>{t('config.addUser')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-2">
                {loading ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay usuarios</p>
                ) : (
                    <div className="space-y-2">
                        {users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between rounded-md border p-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="font-medium text-sm">{user.username}</span>
                                    <Badge variant="secondary">{user.role === 'admin' ? t('config.admin') : t('config.user')}</Badge>
                                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => toggleUser(user)}
                                        disabled={saving || user.id === editingId || isLastEnabledAdmin(user)}
                                        title={isLastEnabledAdmin(user) ? t('config.lastAdminEnabled') : user.enabled ? t('config.enabled') : t('config.disabled')}
                                    >
                                        {user.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => startEdit(user)} title={t('common.edit')}>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                disabled={saving || user.id === editingId || isLastEnabledAdmin(user)}
                                                title={isLastEnabledAdmin(user) ? t('config.lastAdminEnabled') : t('common.delete')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
                                                <AlertDialogDescription>{user.username}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>

                                <Dialog open={editingId === user.id} onOpenChange={(open) => !open && cancelEdit()}>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>{t('config.editUser')}</DialogTitle>
                                            <DialogDescription>{user.username}</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <Input value={editingData.username} onChange={(e) => setEditingData({ ...editingData, username: e.target.value })} placeholder={t('config.username')} />
                                            <Input value={editingData.email} onChange={(e) => setEditingData({ ...editingData, email: e.target.value })} placeholder={t('auth.email')} />
                                            <Input value={editingData.password} onChange={(e) => setEditingData({ ...editingData, password: e.target.value })} type="password" placeholder={t('config.password')} />
                                            <Select value={editingData.role} onValueChange={(value) => setEditingData({ ...editingData, role: value as 'admin' | 'user' })}>
                                                <SelectTrigger><SelectValue placeholder={t('config.role')} /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">{t('config.user')}</SelectItem>
                                                    <SelectItem value="admin">{t('config.admin')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={cancelEdit}>{t('common.cancel')}</Button>
                                            <Button onClick={handleUpdate} disabled={saving}>{t('common.save')}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
