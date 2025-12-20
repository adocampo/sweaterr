#!/usr/bin/env node

/**
 * Test MyJDownloader authentication using CryptoJS (same as Firefox addon)
 * Run: node test-myjd-cryptojs.js [email] [password]
 */

const CryptoJS = require('crypto-js');

function hashPassword(email, pass, domain) {
  return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(email.toLowerCase() + pass + domain.toLowerCase()));
}

function computeHmac(queryString, secret) {
  // secret es un WordArray (como en el addon)
  const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Utf8.parse(queryString), secret);
  return hmac.toString(CryptoJS.enc.Hex);
}

async function main() {
  const email = process.argv[2] || 'malevolent@zoho.com';
  const password = process.argv[3] || 'Test123456';
  const appkey = 'myjd_webextension_firefox';

  console.log('\n=== MyJDownloader Authentication Test (CryptoJS) ===');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`AppKey: ${appkey}\n`);

  try {
    // Step 1: Generate login secret (as WordArray, not hex string)
    console.log('[Step 1] Generando login secret como WordArray...');
    const loginSecret = hashPassword(email, password, 'server');
    console.log(`loginSecret type: ${loginSecret.constructor.name}`);
    console.log(`loginSecret (hex): ${loginSecret.toString()}\n`);

    // Step 2: Build query string with ALPHABETICAL order
    console.log('[Step 2] Construyendo query string...');
    const queryString = `/my/connect?appkey=${appkey}&email=${encodeURIComponent(email.toLowerCase())}&rid=0`;
    console.log(`Query: ${queryString}`);

    // Step 3: Calculate signature (using WordArray key)
    console.log('[Step 3] Calculando firma HMAC-SHA256 con WordArray...');
    const signature = computeHmac(queryString, loginSecret);
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
        console.log('(Response might be encrypted)');
      }
    } else {
      console.log('❌ Falló la autenticación');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);
