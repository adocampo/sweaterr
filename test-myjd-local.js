#!/usr/bin/env node

/**
 * Test MyJDownloader authentication locally
 * Run: node test-myjd-local.js [email] [password]
 */

const { webcrypto } = require('crypto');

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await webcrypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const email = process.argv[2] || 'malevolent@zoho.com';
  const password = process.argv[3] || 'Test123456';
  const appkey = 'myjd_webextension_firefox';

  console.log('\n=== MyJDownloader Authentication Test ===');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`AppKey: ${appkey}\n`);

  try {
    // Step 1: Generate login secret
    console.log('[Step 1] Generando login secret...');
    const loginSecret = await sha256(email.toLowerCase() + password + 'server');
    console.log(`loginSecret: ${loginSecret}\n`);

    // Step 2: Build query string with ALPHABETICAL order (appkey, email, rid)
    console.log('[Step 2] Construyendo query string con orden alfabético...');
    const queryString = `/my/connect?appkey=${appkey}&email=${encodeURIComponent(email.toLowerCase())}&rid=0`;
    console.log(`Query: ${queryString}`);

    // Step 3: Calculate signature
    console.log('[Step 3] Calculando firma HMAC-SHA256...');
    const signature = await hmacSha256(queryString, loginSecret);
    console.log(`Signature: ${signature}\n`);

    // Step 4: Make request
    console.log('[Step 4] Haciendo solicitud a MyJDownloader...');
    const url = `https://api.jdownloader.org${queryString}&signature=${signature}`;
    console.log(`URL: ${url}\n`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const body = await response.text();
    console.log(`Response Body: ${body}\n`);

    if (response.ok) {
      console.log('✅ ¡ÉXITO! Autenticación exitosa');
      try {
        const data = JSON.parse(body);
        console.log(`Session Token: ${data.sessiontoken?.substring(0, 20)}...`);
      } catch (e) {
        console.log('(Response is encrypted, need AES decryption)');
      }
    } else {
      console.log('❌ Falló la autenticación');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);
