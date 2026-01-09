import { NextResponse } from 'next/server';

/**
 * Test simple para verificar credenciales MyJDownloader
 * Abre esta URL en tu navegador: http://localhost:3000/api/config/jdownloader/check-credentials
 */
export async function GET() {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>MyJDownloader Credentials Test</title>
  <style>
    body { font-family: monospace; padding: 20px; max-width: 800px; margin: 0 auto; }
    input, button { padding: 10px; margin: 5px 0; display: block; width: 100%; box-sizing: border-box; }
    button { background: #000; color: #fff; border: none; cursor: pointer; }
    button:hover { background: #333; }
    #result { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px; white-space: pre-wrap; }
    .error { background: #fee; color: #c00; }
    .success { background: #efe; color: #0c0; }
  </style>
</head>
<body>
  <h1>🔑 MyJDownloader Credentials Test</h1>
  <p><strong>Instrucciones:</strong></p>
  <ol>
    <li>Ve a <a href="https://my.jdownloader.org" target="_blank">my.jdownloader.org</a></li>
    <li>Inicia sesión y verifica que tu dispositivo "Samael" está ONLINE</li>
    <li>Usa el MISMO email y contraseña aquí abajo:</li>
  </ol>
  
  <form id="testForm">
    <label>Email:</label>
    <input type="email" id="email" value="email@example.com" required />
    
    <label>Password:</label>
    <input type="password" id="password" value="Test123456" required />
    
    <label>Device Name:</label>
    <input type="text" id="device" value="ServerName" required />
    
    <label>App Key (prueba diferentes):</label>
    <select id="appkey">
      <option value="DEMOAPIAPP">DEMOAPIAPP (oficial demo)</option>
      <option value="vscode-jd-test">vscode-jd-test (custom)</option>
      <option value="myjdapi">myjdapi</option>
      <option value="">Sin appkey</option>
    </select>
    
    <button type="submit">🚀 Test Authentication</button>
  </form>
  
  <div id="result"></div>
  
  <script>
    document.getElementById('testForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const device = document.getElementById('device').value;
      const appkey = document.getElementById('appkey').value;
      
      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = '⏳ Probando autenticación...';
      resultDiv.className = '';
      
      try {
        const params = new URLSearchParams({ email, password, device });
        if (appkey) params.append('appkey', appkey);
        
        const response = await fetch('/api/config/jdownloader/debug-auth?' + params);
        const data = await response.json();
        
        if (data.success) {
          resultDiv.className = 'success';
          resultDiv.innerHTML = 
            '✅ AUTENTICACIÓN EXITOSA\\n\\n' +
            'Session Token: ' + data.sessionToken.substring(0, 20) + '...\\n' +
            'Device ID: ' + data.deviceId + '\\n' +
            'Device Name: ' + data.deviceName + '\\n\\n' +
            'Dispositivos disponibles: ' + data.availableDevices.join(', ') + '\\n\\n' +
            'LOGS:\\n' + data.logs.join('\\n');
        } else {
          resultDiv.className = 'error';
          resultDiv.innerHTML = 
            '❌ ERROR DE AUTENTICACIÓN\\n\\n' +
            'Error: ' + data.error + '\\n' +
            'Error Body: ' + (data.errorBody || 'N/A') + '\\n\\n' +
            'LOGS:\\n' + (data.logs ? data.logs.join('\\n') : 'No logs') + '\\n\\n' +
            '🔍 POSIBLES SOLUCIONES:\\n' +
            '1. Verifica que el email y password sean EXACTAMENTE los mismos de my.jdownloader.org\\n' +
            '2. Ve a my.jdownloader.org → Settings → My Account → Devices\\n' +
            '3. Asegúrate de que "Samael" aparece y está ONLINE (verde)\\n' +
            '4. Si no está online, abre JDownloader en tu PC y espera unos segundos\\n' +
            '5. Prueba diferentes App Keys en el selector de arriba';
        }
      } catch (error) {
        resultDiv.className = 'error';
        resultDiv.innerHTML = '❌ NETWORK ERROR\\n\\n' + error.message;
      }
    });
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
