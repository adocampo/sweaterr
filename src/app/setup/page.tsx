'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SetupForm from './setup-form';

/**
 * Página de configuración inicial.
 *
 * Debe ser un Client Component para quedar pre-renderida como setup.html:
 * el servidor de producción custom (server.js) no ejecuta middleware ni
 * Server Components dinámicos, solo sirve HTML estático y rutas API.
 *
 * La decisión de mostrar el formulario o redirigir se toma en el cliente
 * consultando /api/auth/users-count (público). La API POST /api/auth/setup
 * ya rechaza crear un segundo admin si existen usuarios.
 */
export default function SetupPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'setup' | 'exists'>('loading');

    useEffect(() => {
        let cancelled = false;

        fetch('/api/auth/users-count', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                setStatus(data.success && data.count > 0 ? 'exists' : 'setup');
            })
            .catch(() => {
                // Si no podemos comprobarlo, asumimos que hace falta setup
                // (el backend seguirá protegiendo la creación del admin)
                if (!cancelled) setStatus('setup');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (status === 'exists') {
            router.replace('/login');
        }
    }, [status, router]);

    if (status !== 'setup') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="animate-spin h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent" />
            </div>
        );
    }

    return <SetupForm />;
}
