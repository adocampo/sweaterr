// Test script for JDownloader getDownloads
const { JDownloaderService } = require('./src/lib/services/jdownloader.ts');

async function testGetDownloads() {
  const jd = new JDownloaderService(
    'malevolent@zoho.com',
    'Test123456',
    'Samael'
  );

  console.log('[Test] Authenticating...');
  const authSuccess = await jd.authenticate();
  
  if (!authSuccess) {
    console.error('[Test] Authentication failed');
    return;
  }

  console.log('[Test] ✅ Authenticated successfully');
  console.log('[Test] Getting downloads...');
  
  const downloads = await jd.getDownloads();
  
  console.log('[Test] Downloads:', JSON.stringify(downloads, null, 2));
  console.log('[Test] Total downloads:', downloads.length);
}

testGetDownloads().catch(console.error);
