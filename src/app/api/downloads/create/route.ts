import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { JDownloaderService } from '@/lib/services/jdownloader';
import { z } from 'zod';

const createDownloadSchema = z.object({
  postUrl: z.string().url(),
  forumId: z.string(),
});

// POST /api/downloads/create - Create download from ARR indexer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postUrl, forumId } = createDownloadSchema.parse(body);

    // Get forum and JDownloader config
    const forum = await db.forum.findUnique({
      where: { id: forumId },
      include: { credentials: true },
    });

    const jdConfig = await db.jDownloaderConfig.findFirst();

    if (!forum || !jdConfig) {
      return NextResponse.json({
        success: false,
        error: 'Forum or JDownloader not configured',
      });
    }

    // Check if download already exists
    const existingDownload = await db.download.findFirst({
      where: { sourceUrl: postUrl },
    });

    if (existingDownload) {
      return NextResponse.json({
        success: true,
        message: 'Download already exists',
        data: existingDownload,
      });
    }

    // Initialize services
    const forumService = new ForumService();
    const jdService = new JDownloaderService(
      jdConfig.email,
      jdConfig.password,
      jdConfig.deviceName
    );

    // Add forum to service
    forumService.addForum({
      id: forum.id,
      name: forum.name,
      baseUrl: forum.baseUrl,
      searchPath: forum.searchPath,
      thankButtonSelector: forum.thankButtonSelector || undefined,
      linksContainerSelector: forum.linksContainerSelector || undefined,
      postTitleSelector: forum.postTitleSelector || undefined,
      requiresAuthentication: forum.requiresAuthentication,
      credentials: forum.credentials ? {
        username: forum.credentials.username,
        password: forum.credentials.password,
      } : undefined,
    });

    // Authenticate with forum
    if (forum.requiresAuthentication && forum.credentials) {
      const authSuccess = await forumService.authenticate(forum.id);
      if (!authSuccess) {
        return NextResponse.json({
          success: false,
          error: 'Failed to authenticate with forum',
        });
      }
    }

    // Parse post to extract links
    const post = await forumService.parsePost(forum.id, postUrl);

    if (post.links.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No download links found in post',
      });
    }

    // Click thank button if required
    if (post.thankRequired) {
      await forumService.clickThankButton(forum.id, postUrl);
    }

    // Authenticate with JDownloader
    const jdAuthSuccess = await jdService.authenticate();
    if (!jdAuthSuccess) {
      return NextResponse.json({
        success: false,
        error: 'Failed to authenticate with JDownloader',
      });
    }

    // Add links to JDownloader
    const linksAdded = await jdService.addLinks(post.links);
    if (!linksAdded) {
      return NextResponse.json({
        success: false,
        error: 'Failed to add links to JDownloader',
      });
    }

    // Create download record
    const download = await db.download.create({
      data: {
        title: post.title,
        sourceUrl: postUrl,
        forumName: forum.name,
        status: 'pending',
        progress: 0,
      },
      include: {
        notifications: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Download created successfully',
      data: {
        download,
        post: {
          title: post.title,
          linksCount: post.links.length,
          forum: post.forum,
        },
      },
    });

  } catch (error) {
    console.error('Error creating download:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create download' },
      { status: 500 }
    );
  }
}