import { GET as baseGET, POST as basePOST } from '../route';

export const runtime = 'nodejs';

// Sonarr's "URL Base" field appends "/api" automatically.
// If the user configures URL Base as "/api/sabnzbd/api", Sonarr will call "/api/sabnzbd/api/api".
// This file provides a compatibility alias.

export const GET = baseGET;
export const POST = basePOST;
