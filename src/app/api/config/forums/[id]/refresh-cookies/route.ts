import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID del foro requerido' },
                { status: 400 }
            );
        }

        const forum = await db.forum.findUnique({ where: { id } });
        if (!forum) {
            return NextResponse.json(
                { success: false, error: 'Foro no encontrado' },
                { status: 404 }
            );
        }

        // Clear persistent cookies and timestamp
        await db.forum.update({
            where: { id },
            data: {
                persistentCookies: null,
                cookiesUpdatedAt: null,
            }
        });

        console.log(`[Config] Persistent cookies cleared for forum: ${forum.name}`);

        return NextResponse.json({
            success: true,
            message: 'Cookies persistentes borradas. Ejecuta "Probar conexión" para obtener nuevas cookies.'
        });
    } catch (error) {
        console.error('[Config] Error clearing cookies:', error);
        return NextResponse.json(
            { success: false, error: 'Error al borrar las cookies' },
            { status: 500 }
        );
    }
}
