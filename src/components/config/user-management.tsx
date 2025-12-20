"use client";

import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks/use-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface UserRecord {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
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
        if (!confirm('¿Eliminar usuario?')) return;
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

    return (
        <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="space-y-2">
                <h4 className="font-semibold">{t('config.addUser')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                        placeholder={t('config.username')}
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    <Input
                        placeholder={t('auth.email')}
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                        placeholder={t('config.password')}
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <Select
                        value={form.role}
                        onValueChange={(value) => setForm({ ...form, role: value as 'admin' | 'user' })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t('config.role')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">{t('config.user')}</SelectItem>
                            <SelectItem value="admin">{t('config.admin')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full md:w-auto">
                    {t('config.addUser')}
                </Button>
            </div>

            <Separator />

            <div className="space-y-2">
                <h4 className="font-semibold">{t('config.users')}</h4>
                {loading ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay usuarios</p>
                ) : (
                    <div className="space-y-3">
                        {users.map((user) => (
                            <div key={user.id} className="border rounded-md p-3 space-y-2">
                                {editingId === user.id ? (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <Input
                                                value={editingData.username}
                                                onChange={(e) => setEditingData({ ...editingData, username: e.target.value })}
                                                placeholder={t('config.username')}
                                            />
                                            <Input
                                                value={editingData.email}
                                                onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                                                placeholder={t('auth.email')}
                                            />
                                            <Input
                                                value={editingData.password}
                                                onChange={(e) => setEditingData({ ...editingData, password: e.target.value })}
                                                type="password"
                                                placeholder={t('config.password') + ' (opcional)'}
                                            />
                                            <Select
                                                value={editingData.role}
                                                onValueChange={(value) => setEditingData({ ...editingData, role: value as 'admin' | 'user' })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('config.role')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">{t('config.user')}</SelectItem>
                                                    <SelectItem value="admin">{t('config.admin')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={handleUpdate} disabled={saving}>
                                                {t('common.save')}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                                                {t('common.cancel')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="font-medium text-sm">{user.username}</p>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                            <p className="text-xs text-muted-foreground">{user.role}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => startEdit(user)}>
                                                {t('common.edit')}
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)} disabled={saving}>
                                                {t('common.delete')}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
