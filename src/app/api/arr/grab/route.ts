import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ForumService } from '@/lib/services/forum';
import { JDownloaderService } from '@/lib/services/jdownloader';

// GET /api/arr/grab - Download link grab endpoint
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('apikey') || request.headers.get('x-api-key');
        const guid = searchParams.get('guid'); // format: forumId-postUrl

        if (!apiKey || !guid) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key or GUID"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Validate API key
        const service = await db.arrService.findUnique({
            where: { apiKey },
        });

        if (!service || !service.enabled) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="100" description="Invalid API Key"/>`,
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Parse GUID (forumId-postUrl)
        const [forumId, ...urlParts] = guid.split('-');
        const postUrl = urlParts.join('-');

        if (!forumId || !postUrl) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Invalid GUID format"/>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Get forum and JDownloader config
        const forum = await db.forum.findUnique({
            where: { id: forumId },
            include: { credentials: true },
        });

        const jdConfig = await db.jDownloaderConfig.findFirst({ where: { enabled: true } });

        if (!forum || !jdConfig) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Forum or JDownloader not configured"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
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
            credentials: forum.credentials ? {
                username: forum.credentials.username,
                password: forum.credentials.password,
            } : undefined,
        });

        // Authenticate with forum if needed
        if (forum.credentials) {
            const authSuccess = await forumService.authenticate(forum.id);
            if (!authSuccess) {
                return new NextResponse(
                    `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Forum authentication failed"/>`,
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/xml' },
                    }
                );
            }
        }

        // Parse post to extract links
        const post = await forumService.parsePost(forum.id, postUrl);

        if (post.links.length === 0) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="No download links found"/>`,
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Click thank button if required
        if (post.thankRequired) {
            await forumService.clickThankButton(forum.id, postUrl);
        }

        // Authenticate with JDownloader
        const jdAuthSuccess = await jdService.authenticate();
        if (!jdAuthSuccess) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="JDownloader authentication failed"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Add links to JDownloader with package name from ARR
        const packageName = post.title; // Use post title as package name
        const linksAdded = await jdService.addLinks(post.links, packageName);

        if (!linksAdded) {
            return new NextResponse(
                `<?xml version="1.0" encoding="UTF-8"?>
<error code="300" description="Failed to add links to JDownloader"/>`,
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/xml' },
                }
            );
        }

        // Create download record with ARR context
        const download = await db.download.create({
            data: {
                title: post.title,
                sourceUrl: postUrl,
                forumName: forum.name,
                status: 'pending',
                progress: 0,
                arrType: service.type,
                grabId: guid,
                releaseTitle: post.title,
            },
        });

        // Return success (ARR expects HTTP 200)
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<success message="Download added to JDownloader"/>`,
            {
                status: 200,
                headers: { 'Content-Type': 'application/xml' },
            }
        );
    } catch (error) {
        console.error('Error in grab endpoint:', error);
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<error code="900" description="Internal server error"/>`,
            {
                status: 500,
                headers: { 'Content-Type': 'application/xml' },
            }
        );
    }
}
