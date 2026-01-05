'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTestingSettings } from '@/hooks/use-api';
import { Loader2 } from 'lucide-react';

export function TestingSettings() {
    const { bypassAxios, loading, updateSettings } = useTestingSettings();
    const [localBypassAxios, setLocalBypassAxios] = useState(bypassAxios);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalBypassAxios(bypassAxios);
    }, [bypassAxios]);

    const handleToggle = async (value: boolean) => {
        setLocalBypassAxios(value);
        setIsSaving(true);

        try {
            await updateSettings(value);
        } catch (err) {
            console.error('Error updating setting:', err);
            setLocalBypassAxios(bypassAxios); // Revert on error
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Cargando configuración...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Testing</CardTitle>
                <CardDescription>
                    Opciones avanzadas para resolver títulos y extraer enlaces
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                        <div className="font-medium">Modo Directo (Bypass Axios)</div>
                        <div className="text-sm text-muted-foreground">
                            Usar FlareSolverr directamente sin intentar Axios primero.
                            <br />
                            <strong>Útil si:</strong> Las cookies no se reutilizan correctamente o quieres evitar intentos fallidos.
                            <br />
                            <strong>Impacto:</strong> ~30 segundos por petición (en lugar de ~1 segundo con cookies válidas)
                        </div>
                    </div>
                    <Switch
                        checked={localBypassAxios}
                        onCheckedChange={handleToggle}
                        disabled={isSaving}
                        className="ml-4"
                    />
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="text-sm text-amber-900 dark:text-amber-100">
                        <strong>⚠️ Nota:</strong> Este modo está diseñado para diagnóstico. Una vez que se validen las cookies,
                        desactívalo para volver al modo normal más rápido.
                    </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>💡 Consejo:</strong> Si las cookies persisten, intenta resolver múltiples títulos a la vez desde la UI
                        para aprovechar la misma sesión de FlareSolverr.
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
