import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Modo Local: IP/Hostname + Puerto
const localModeSchema = z.object({
  mode: z.literal('local'),
  connectionName: z.string().min(1),
  localHost: z.string().min(1),
  localPort: z.number().min(1),
});

// Modo Cloud: Email + Password + Device Name
const cloudModeSchema = z.object({
  mode: z.literal('cloud'),
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().min(1),
});

const jdownloaderConfigSchema = z.discriminatedUnion('mode', [
  localModeSchema,
  cloudModeSchema,
]);

// GET /api/config/jdownloader - Get all JDownloader instances
export async function GET() {
  try {
    const instances = await db.jDownloaderConfig.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      instances,
    });
  } catch (error) {
    console.error('Error fetching JDownloader configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch JDownloader configs' },
      { status: 500 }
    );
  }
}

// POST /api/config/jdownloader - Create or update JDownloader instance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = jdownloaderConfigSchema.parse(body);

    const config = await db.jDownloaderConfig.create({
      data: {
        mode: validatedData.mode,
        ...(validatedData.mode === 'local' && {
          connectionName: validatedData.connectionName,
          localHost: validatedData.localHost,
          localPort: validatedData.localPort,
        }),
        ...(validatedData.mode === 'cloud' && {
          email: validatedData.email,
          password: validatedData.password,
          deviceName: validatedData.deviceName,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error saving JDownloader config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save JDownloader config' },
      { status: 500 }
    );
  }
}

// DELETE /api/config/jdownloader - Delete a JDownloader instance
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    await db.jDownloaderConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'JDownloader instance deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting JDownloader config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete JDownloader config' },
      { status: 500 }
    );
  }
}

// PUT /api/config/jdownloader - Update JDownloader instance
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    // Si solo viene enabled, es un toggle
    if (body.enabled !== undefined && Object.keys(body).length === 1) {
      console.log(`[JDownloader] Toggling ${id} to enabled=${body.enabled}`);
      const config = await db.jDownloaderConfig.update({
        where: { id },
        data: { enabled: body.enabled },
      });
      console.log(`[JDownloader] Toggled successfully:`, config);
      return NextResponse.json({ success: true, data: config });
    }

    const validatedData = jdownloaderConfigSchema.parse(body);

    const updateData: any = {};

    if (validatedData.mode === 'local') {
      updateData.connectionName = validatedData.connectionName;
      updateData.localHost = validatedData.localHost;
      updateData.localPort = validatedData.localPort;
    } else if (validatedData.mode === 'cloud') {
      updateData.email = validatedData.email;
      updateData.password = validatedData.password;
      updateData.deviceName = validatedData.deviceName;
    }

    const config = await db.jDownloaderConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error updating JDownloader config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update JDownloader config' },
      { status: 500 }
    );
  }
}