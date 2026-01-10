// JDownloader API client
// Supports two connection methods:
// 1. Local RemoteAPI (deprecated but fast): http://localhost:3128/api/v1/
// 2. My JDownloader (remote): https://api.jdownloader.org
// Based on My JDownloader API: https://my.jdownloader.org/developers/
// Implements official AES/HMAC-SHA256 authentication flow

import { webcrypto } from 'node:crypto';
// Import CryptoJS - used for MyJD authentication (matches official addon implementation)
const CryptoJS = require('crypto-js');
import { logger } from '@/lib/logger';

// Extend CryptoJS WordArray with firstHalf() and secondHalf() methods (from jdapi.js lines 18-28)
// MUST be defined BEFORE creating any WordArrays
// In CryptoJS, WordArray uses a special inheritance system, we extend it directly
CryptoJS.lib.WordArray.firstHalf = function (this: any) {
  if (!this._firstHalf) {
    this._firstHalf = CryptoJS.lib.WordArray.create(this.words.slice(0, this.words.length / 2));
  }
  return this._firstHalf;
};

CryptoJS.lib.WordArray.secondHalf = function (this: any) {
  if (!this._secondHalf) {
    this._secondHalf = CryptoJS.lib.WordArray.create(this.words.slice(this.words.length / 2, this.words.length));
  }
  return this._secondHalf;
};

export interface JDownloaderDevice {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface JDownloaderDownload {
  linkId: number;
  uuid: string;
  packageId?: number;
  name: string;
  host: string;
  size: number;
  status: string;
  progress: number;
  speed: number;
  eta: number;
  source: 'linkgrabber' | 'downloads';
  url?: string;
  saveTo?: string;
  addedAt?: number;
  finishedAt?: number;
  category?: string;
}

export interface JDownloaderLinksResponse {
  links: Array<{
    uuid: string;
    name: string;
    url: string;
    enabled: boolean;
    availability: boolean;
  }>;
}

interface MyJDConnectResponse {
  sessiontoken: string;
  regaintoken: string;
  rid: number;
}

interface MyJDDevice {
  id: string;
  name: string;
  type: string;
}

// ============================================================================
// LOCAL REMOTE API (Deprecated but fast)
// ============================================================================

export class JDownloaderLocalService {
  private baseUrl: string;

  constructor(host: string = 'localhost', port: number = 3128) {
    this.baseUrl = `http://${host}:${port}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Local RemoteAPI responde a los mismos controladores que MyJD,
      // sin prefijo de dispositivo/sesión. Usamos system/getSystemInfos.
      const response = await fetch(`${this.baseUrl}/system/getSystemInfos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({}),
      });
      // En algunas versiones devuelve 400 BAD_PARAMETERS incluso estando disponible.
      // Consideramos "disponible" si el host responde (no 5xx).
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async addLinks(urls: string[], packageName?: string, autostart?: boolean, autoExtract?: boolean): Promise<boolean> {
    try {
      logger.info('jdownloader', `[LocalJD] Añadiendo ${urls.length} enlace(s)...`);
      // Según prueba del usuario, el endpoint correcto es /linkgrabberv2/addLinks
      const response = await fetch(`${this.baseUrl}/linkgrabberv2/addLinks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          links: urls.join('\n'),
          packageName: packageName,
          priority: 'DEFAULT',
          autostart: autostart ?? false,
          extractAfterDownload: autoExtract ?? false,
          deepDecrypt: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      logger.info('jdownloader', `[LocalJD] Enlaces añadidos exitosamente`);
      return true;
    } catch (error) {
      logger.error('jdownloader', '[LocalJD] Add links failed:', error);
      return false;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/system/getSystemInfos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('jdownloader', '[LocalJD] Get status failed:', error);
      return null;
    }
  }
}

// ============================================================================
// MY JDOWNLOADER (Remote API)
// ============================================================================

export class JDownloaderService {
  private email: string;
  private password: string;
  private deviceName: string;
  private sessionToken?: string;
  private regainToken?: string;
  private deviceId?: string;
  private loginSecret?: any;  // Now stored as WordArray
  private deviceSecret?: any; // Now stored as WordArray
  private serverEncryptionToken?: any;
  private deviceEncryptionToken?: any;
  private appKey = 'myjd_webextension_firefox'; // Del addon oficial
  private baseUrl = 'https://api.jdownloader.org';

  constructor(email: string | null | undefined, password: string | null | undefined, deviceName: string | null | undefined) {
    this.email = (email ?? '').toLowerCase();
    this.password = password ?? '';
    this.deviceName = deviceName ?? '';
  }

  // SHA256 hash helper - returns WordArray (like official addon)
  private sha256(text: string): any {
    return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(text));
  }

  // HMAC-SHA256 signature helper - accepts WordArray as key (like official addon)
  private hmacSha256(message: string, secret: any): string {
    const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Utf8.parse(message), secret);
    return hmac.toString(CryptoJS.enc.Hex);
  }

  // Create login and device secrets
  private createSecrets(): void {
    // Siguiendo el patrón de jdapi.js oficial:
    // hashPassword: SHA256(email.toLowerCase() + password + domain.toLowerCase())
    this.loginSecret = this.sha256(this.email + this.password + 'server');
    this.deviceSecret = this.sha256(this.email + this.password + 'device');
  }

  // Authenticate with My JDownloader using official handshake
  async authenticate(): Promise<boolean> {
    try {
      logger.info('jdownloader', 'Iniciando autenticación...');
      logger.info('jdownloader', `Email: ${this.email}`);

      // Step 1: Create login and device secrets
      this.createSecrets();
      logger.info('jdownloader', `loginSecret (hex): ${this.loginSecret!.toString().substring(0, 16)}...`);
      logger.info('jdownloader', `loginSecret words count: ${this.loginSecret!.words.length}`);

      // Test firstHalf and secondHalf
      try {
        const testFirstHalf = this.loginSecret!.firstHalf();
        const testSecondHalf = this.loginSecret!.secondHalf();
        logger.info('jdownloader', `firstHalf words: ${testFirstHalf.words.length}`);
        logger.info('jdownloader', `secondHalf words: ${testSecondHalf.words.length}`);
      } catch (e) {
        logger.error('jdownloader', 'ERROR calling firstHalf/secondHalf', e);
        throw e;
      }

      // Step 2: Connect and get session token
      // Orden alfabético: appkey, email, rid
      const connectQuery = `/my/connect?appkey=${this.appKey}&email=${encodeURIComponent(this.email)}&rid=0`;
      const signature = this.hmacSha256(connectQuery, this.loginSecret!);
      const connectUrl = `${this.baseUrl}${connectQuery}&signature=${signature}`;

      logger.info('jdownloader', `Query: ${connectQuery}`);
      logger.info('jdownloader', `Signature: ${signature.substring(0, 16)}...`);
      logger.info('jdownloader', `Full URL: ${connectUrl}`);
      logger.info('jdownloader', 'Conectando a MyJDownloader...');

      const connectResponse = await fetch(connectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      logger.info('jdownloader', `Response status: ${connectResponse.status}`);
      logger.info('jdownloader', 'Response headers', Object.fromEntries(connectResponse.headers.entries()));

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        logger.error('jdownloader', `Connect failed: ${connectResponse.status}`, errorText);
        throw new Error(`Connect failed: ${connectResponse.status} - ${errorText}`);
      }

      // Response is encrypted with AES-CBC. Need to decrypt it.
      // Decryption key = loginSecret.secondHalf(), IV = loginSecret.firstHalf()
      const encryptedResponse = await connectResponse.text();
      logger.info('jdownloader', `Response (encrypted, length): ${encryptedResponse.length}`);
      logger.info('jdownloader', `Response (encrypted, first 50): ${encryptedResponse.substring(0, 50)}...`);

      // Decrypt response
      logger.info('jdownloader', 'Attempting to decrypt response...');
      try {
        const connectData = this.decryptAES(encryptedResponse, this.loginSecret!);
        logger.info('jdownloader', 'Decryption successful!');
        logger.info('jdownloader', `Connect data keys: ${Object.keys(connectData).join(', ')}`);
        this.sessionToken = connectData.sessiontoken;
        this.regainToken = connectData.regaintoken;
      } catch (decryptError) {
        logger.error('jdownloader', 'Decryption failed', decryptError);
        throw new Error(`Failed to decrypt response: ${decryptError}`);
      }

      // Derive encryption tokens using WordArray.concat() (like official addon)
      const sessionTokenHex = CryptoJS.enc.Hex.parse(this.sessionToken);

      // serverEncryptionToken = SHA256(loginSecret.concat(sessionToken))
      const serverTokenInput = this.loginSecret!.concat(sessionTokenHex);
      this.serverEncryptionToken = CryptoJS.SHA256(serverTokenInput);

      // deviceEncryptionToken = SHA256(deviceSecret.concat(sessionToken))
      const deviceTokenInput = this.deviceSecret!.concat(sessionTokenHex);
      this.deviceEncryptionToken = CryptoJS.SHA256(deviceTokenInput);

      logger.info('jdownloader', 'Sesión establecida, obteniendo dispositivos...');

      // Step 3: List devices
      const devicesPath = `/my/listdevices`;
      const devicesQuery = `${devicesPath}?sessiontoken=${this.sessionToken}&rid=0`;
      const devicesSignature = this.hmacSha256(devicesQuery, this.serverEncryptionToken!);
      const devicesUrl = `${this.baseUrl}${devicesQuery}&signature=${devicesSignature}`;

      const devicesResponse = await fetch(devicesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!devicesResponse.ok) {
        const errorText = await devicesResponse.text();
        logger.error('jdownloader', `List devices failed: ${devicesResponse.status}`, errorText);
        this.lastError = `LIST_DEVICES_FAILED (${devicesResponse.status})`;
        throw new Error(`Failed to get devices: ${devicesResponse.status}`);
      }

      // Decrypt device list
      const encryptedDeviceResponse = await devicesResponse.text();
      const devicesData = this.decryptAES(encryptedDeviceResponse, this.serverEncryptionToken!);
      const devices: MyJDDevice[] = devicesData.list || [];

      logger.info('jdownloader', `Dispositivos encontrados: ${devices.map(d => d.name).join(', ')}`);

      const device = devices.find((d: MyJDDevice) => d.name.toLowerCase() === this.deviceName.toLowerCase());

      if (!device) {
        logger.error('jdownloader', `Dispositivo "${this.deviceName}" no encontrado. Disponibles: ${devices.map(d => d.name).join(', ')}`);
        this.lastError = `DEVICE_NOT_FOUND: ${this.deviceName}`;
        throw new Error(`Device "${this.deviceName}" not found`);
      }

      this.deviceId = device.id;
      logger.info('jdownloader', `Autenticación exitosa con dispositivo: ${this.deviceName} (${this.deviceId})`);
      return true;

    } catch (error) {
      logger.error('jdownloader', 'Authentication error', error);
      if (!this.lastError) {
        this.lastError = error instanceof Error ? error.message : 'Authentication error';
      }
      return false;
    }
  }

  // AES-CBC decryption helper (matches jdapi.js encryptJSON line 127-133)
  private decryptAES(encryptedBase64: string, secret: any): any {
    try {
      logger.info('jdownloader', 'decryptAES: Starting decryption');
      logger.info('jdownloader', `decryptAES: Encrypted string length: ${encryptedBase64.length}`);
      logger.info('jdownloader', `decryptAES: Secret type: ${typeof secret}`);
      logger.info('jdownloader', `decryptAES: Secret has words: ${!!secret.words}`);

      // Split secret using firstHalf() and secondHalf() methods (like jdapi.js)
      const iv = secret.firstHalf();
      const key = secret.secondHalf();

      logger.info('jdownloader', `decryptAES: IV (hex): ${iv.toString().substring(0, 16)}...`);
      logger.info('jdownloader', `decryptAES: Key (hex): ${key.toString().substring(0, 16)}...`);

      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedBase64) },
        key,
        { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
      );

      logger.info('jdownloader', 'decryptAES: AES.decrypt completed');
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      logger.info('jdownloader', `decryptAES: Decrypted text length: ${decryptedText.length}`);
      logger.info('jdownloader', `decryptAES: Decrypted text (first 50): ${decryptedText.substring(0, 50)}`);

      const parsed = JSON.parse(decryptedText);
      logger.info('jdownloader', 'decryptAES: JSON parsed successfully');
      return parsed;
    } catch (error) {
      logger.error('jdownloader', 'Decryption error details', error);
      logger.error('jdownloader', `Stack: ${(error as Error).stack}`);
      throw error;
    }
  }

  // AES-CBC encryption helper (matches jdapi.js encryptJSON line 127-133)
  private encryptAES(plainText: string, secret: any): string {
    try {
      // Split secret using firstHalf() and secondHalf() methods (like jdapi.js)
      const iv = secret.firstHalf();
      const key = secret.secondHalf();

      const encrypted = CryptoJS.AES.encrypt(
        plainText,
        key,
        { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
      );

      return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    } catch (error) {
      logger.error('jdownloader', 'Encryption error', error);
      throw error;
    }
  }

  // Add links to JDownloader using linkgrabberv2/addLinks
  async addLinks(
    urls: string[],
    packageName?: string,
    autostart?: boolean,
    autoExtract?: boolean
  ): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    try {
      logger.info('jdownloader', `Añadiendo ${urls.length} enlace(s) a ${this.deviceName}...`);

      const rid = Date.now();
      const endpoint = '/linkgrabberv2/addLinks';
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      // Build request parameters (matching local API structure)
      const params: any = {
        links: urls.join('\n'),
        priority: 'DEFAULT',
        autostart: autostart ?? false,         // default: don't start automatically
        autoExtract: autoExtract ?? false,     // JD API uses autoExtract
        deepDecrypt: true,
      };

      // Only send packageName when user provided one; otherwise let JD/packagizer decide
      if (packageName && packageName.trim().length > 0) {
        params.packageName = packageName.trim();
      }

      // Build jdData object (matching jdapi.js line 734-745)
      const jdData = {
        url: endpoint,
        params: [JSON.stringify(params)],  // Array of JSON strings, not objects
        apiVer: 1,
        rid: rid,
      };

      // Encrypt request body with deviceEncryptionToken
      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      logger.info('jdownloader', `Encrypted request body length: ${encryptedBody.length}`);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('jdownloader', `Add links failed: ${response.status}`, errorText);

        // Try to decrypt error response (server sends errors encrypted too)
        try {
          const decryptedError = this.decryptAES(errorText, this.deviceEncryptionToken!);
          logger.error('jdownloader', '[MyJD] Decrypted error:', JSON.stringify(decryptedError, null, 2));
          throw new Error(`Failed to add links: ${response.status} - ${JSON.stringify(decryptedError)}`);
        } catch (decryptError) {
          logger.error('jdownloader', '[MyJD] Could not decrypt error response:', decryptError);
          throw new Error(`Failed to add links: ${response.status} - ${errorText}`);
        }
      }

      // Decrypt response
      const encryptedResponse = await response.text();
      const result = this.decryptAES(encryptedResponse, this.deviceEncryptionToken!);

      logger.info('jdownloader', 'Enlaces añadidos correctamente');
      logger.info('jdownloader', 'Response', result);
      return true;

    } catch (error) {
      logger.error('jdownloader', 'Add links error', error);
      return false;
    }
  }

  // Get download list from both LinkGrabber and DownloadController
  async getDownloads(): Promise<JDownloaderDownload[]> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    try {
      logger.info('jdownloader', 'Getting downloads from LinkGrabber and DownloadController...');

      // Get packages from both sources
      const [linkGrabberPackages, downloadPackages] = await Promise.all([
        this.queryPackages('/linkgrabberv2/queryPackages'),
        this.queryPackages('/downloadsV2/queryPackages')
      ]);

      logger.info('jdownloader', `Found ${linkGrabberPackages.length} LinkGrabber packages and ${downloadPackages.length} Download packages`);

      // Get links for each package
      const allLinks: JDownloaderDownload[] = [];
      const packages = [...linkGrabberPackages, ...downloadPackages];

      for (const pkg of packages) {
        const links = await this.queryLinksForPackage(pkg, pkg.isLinkGrabber);
        allLinks.push(...links);
      }

      logger.info('jdownloader', `Total links found: ${allLinks.length}`);
      return allLinks;

    } catch (error) {
      logger.error('jdownloader', 'Get downloads error', error);
      return [];
    }
  }

  // Query packages from an endpoint
  private async queryPackages(endpoint: string): Promise<Array<{ uuid: string | number, name: string, isLinkGrabber: boolean, hosts?: string[], saveTo?: string, addedAt?: number }>> {
    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      // Minimal required params for queryPackages
      const queryParams = [{
        saveTo: true,  // Include saveTo field
        hosts: true,   // Include hosts field
        maxResults: -1,
        startAt: 0
      }];

      const jdData = {
        url: endpoint,
        params: queryParams.map(p => JSON.stringify(p)),
        apiVer: 1,
        rid: rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      logger.info('jdownloader', `[MyJD] Querying ${endpoint}...`);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('jdownloader', `[MyJD] Query ${endpoint} failed:`, response.status);

        // Try to decrypt error message
        try {
          const decryptedError = this.decryptAES(errorText, this.deviceEncryptionToken!);
          logger.error('jdownloader', `[MyJD] Error:`, decryptedError);
        } catch (e) {
          logger.error('jdownloader', `[MyJD] Could not decrypt error`);
        }

        return [];
      }

      const encryptedResponse = await response.text();
      const data = this.decryptAES(encryptedResponse, this.deviceEncryptionToken!);

      if (!data.data || !Array.isArray(data.data)) {
        logger.info('jdownloader', `[MyJD] No packages in ${endpoint}`);
        return [];
      }

      logger.info('jdownloader', `[MyJD] Found ${data.data.length} packages in ${endpoint}`);

      return data.data.map((pkg: any) => ({
        uuid: pkg.uuid,
        name: pkg.name || 'Unknown Package',
        isLinkGrabber: endpoint.includes('linkgrabber'),
        hosts: pkg.hosts,
        saveTo: pkg.saveTo,
        addedAt: pkg.added,
      }));
    } catch (error) {
      logger.error('jdownloader', `[MyJD] Query ${endpoint} error:`, error);
      return [];
    }
  }

  // Query links for a specific package
  private async queryLinksForPackage(pkg: { uuid: string | number; name: string; hosts?: string[]; saveTo?: string; addedAt?: number }, isLinkGrabber: boolean): Promise<JDownloaderDownload[]> {
    try {
      const rid = Date.now();
      const endpoint = isLinkGrabber ? '/linkgrabberv2/queryLinks' : '/downloadsV2/queryLinks';
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      const queryParams = {
        packageUUIDs: [Number(pkg.uuid)],  // JD API expects numbers
        bytesTotal: true,
        bytesLoaded: true,
        speed: true,
        eta: true,
        finished: true,
        running: true,
        status: true,
        extractionStatus: true,
        enabled: true,
        url: true,
        addedDate: true,
        finishedDate: true,
        maxResults: -1,
        startAt: 0,
      };

      const jdData = {
        url: endpoint,
        params: [JSON.stringify(queryParams)],
        apiVer: 1,
        rid: rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        logger.error('jdownloader', `[MyJD] Query links for package ${pkg.uuid} failed:`, response.status);
        return [];
      }

      const encryptedResponse = await response.text();
      const data = this.decryptAES(encryptedResponse, this.deviceEncryptionToken!);

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.map((link: any) => {
        const parsedId = typeof link.uuid === 'number'
          ? link.uuid
          : typeof link.id === 'number'
            ? link.id
            : Number.parseInt(link.uuid || link.id, 10);
        const linkId = Number.isFinite(parsedId) ? parsedId : Date.now();

        return {
          linkId,
          uuid: String(link.uuid || link.id || linkId),
          packageId: Number(pkg.uuid),
          name: link.name || 'Unknown',
          host: link.host || link.hostname || (pkg.hosts && pkg.hosts[0]) || 'Unknown',
          size: link.bytesTotal || 0,
          status: this.mapStatus(link),
          progress: link.bytesLoaded && link.bytesTotal ? (link.bytesLoaded / link.bytesTotal * 100) : 0,
          speed: link.speed || 0,
          eta: link.eta || 0,
          source: isLinkGrabber ? 'linkgrabber' : 'downloads',
          url: link.url || link.downloadurl || undefined,
          saveTo: pkg.saveTo,
          addedAt: link.addedDate || pkg.addedAt,
          finishedAt: link.finishedDate,
          category: link.packageName || pkg.name,
        } as JDownloaderDownload;
      });

    } catch (error) {
      logger.error('jdownloader', `[MyJD] Query links for package ${pkg.uuid} error:`, error);
      return [];
    }
  }

  // Helper method to query links from a specific endpoint
  private async queryLinks(endpoint: string): Promise<JDownloaderDownload[]> {
    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      // Query params object
      const queryParams = {
        bytesTotal: true,
        bytesLoaded: true,
        speed: true,
        eta: true,
        finished: true,
        running: true,
        status: true,
        extractionStatus: true,
        enabled: true,
        maxResults: -1,
        startAt: 0,
      };

      // Build jdData object (matching addLinks format)
      const jdData = {
        url: endpoint,
        params: [JSON.stringify(queryParams)],  // Array of JSON strings
        apiVer: 1,
        rid: rid,
      };

      // Encrypt request body with deviceEncryptionToken
      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('jdownloader', `[MyJD] Query ${endpoint} failed:`, response.status, errorText);
        return [];
      }

      // Decrypt response
      const encryptedResponse = await response.text();
      const data = this.decryptAES(encryptedResponse, this.deviceEncryptionToken!);

      logger.info('jdownloader', `[MyJD] ${endpoint} response:`, JSON.stringify(data).substring(0, 500));

      // Map JDownloader API response to our interface
      if (!data.data || !Array.isArray(data.data)) {
        logger.info('jdownloader', `[MyJD] No items found in ${endpoint}`);
        return [];
      }

      return data.data.map((link: any) => {
        const parsedId = typeof link.uuid === 'number'
          ? link.uuid
          : typeof link.id === 'number'
            ? link.id
            : Number.parseInt(link.uuid || link.id || link.packageUUID, 10);
        const linkId = Number.isFinite(parsedId) ? parsedId : Date.now();

        const status = this.mapStatus(link);
        let progress = link.bytesLoaded && link.bytesTotal ? (link.bytesLoaded / link.bytesTotal * 100) : 0;
        // Evitar mostrar 100% durante extracción: usar un valor indicativo
        if (status === 'extracting' && progress >= 100) {
          progress = 50;
        }

        return {
          linkId,
          uuid: link.uuid || String(link.id || link.packageUUID || linkId),
          name: link.name || 'Unknown',
          host: link.host || link.hostname || 'Unknown',
          size: link.bytesTotal || 0,
          status,
          progress,
          speed: link.speed || 0,
          eta: link.eta || 0,
        } as JDownloaderDownload;
      });

    } catch (error) {
      logger.error('jdownloader', `[MyJD] Query ${endpoint} error:`, error);
      return [];
    }
  }

  // Helper to map JD status to our status
  private mapStatus(link: any): string {
    try {
      if (!link || typeof link !== 'object') return 'pending';

      // First: check extraction status (takes precedence over download status)
      if (link.extractionStatus) {
        const ex = String(link.extractionStatus).toUpperCase();
        if (ex.includes('RUN') || ex.includes('EXTRACT')) return 'extracting';
        if (ex.includes('OK') || ex.includes('SUCCESS')) return 'Extraction OK';
        if (ex.includes('FAIL') || ex.includes('ERROR')) return 'failed';
      }

      // Second: check running flag (download is active)
      if (link.running === true) return 'running';

      // Third: check string status for running/extracting
      const jdStatus: string | undefined = link?.status;
      if (jdStatus) {
        const status = jdStatus.toLowerCase();
        if (status.includes('running') || status.includes('download')) return 'running';
        if (status.includes('extract')) return 'extracting';
        if (status.includes('failed') || status.includes('error')) return 'failed';
        if (status.includes('stopped')) return 'stopped';
        if (status.includes('paused')) return 'paused';
        if (status.includes('finished') || status.includes('complete')) return 'finished';
      }

      // Finally: check finished flag only if no status string or extraction running
      if (link.finished === true) return 'finished';

      return 'pending';
    } catch {
      return 'pending';
    }
  }

  // Get device status
  async getDeviceStatus(): Promise<any> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    try {
      const rid = Date.now();
      const statusPath = `/t_${this.sessionToken}_${this.deviceId}/system/getSystemInfos`;
      const queryString = `${statusPath}?rid=${rid}`;
      const signature = this.hmacSha256(queryString, this.deviceEncryptionToken);
      const url = `${this.baseUrl}${queryString}&signature=${signature}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get device status');
      }

      return await response.json();

    } catch (error) {
      logger.error('jdownloader', 'Get device status error', error);
      return null;
    }
  }

  // =============================
  // Control actions
  // =============================

  private normalizeIds(linkIds: Array<string | number>): number[] {
    const numeric = linkIds
      .map((id) => (typeof id === 'number' ? id : Number.parseInt(id, 10)))
      .filter((id) => Number.isFinite(id));
    if (numeric.length === 0) {
      logger.error('jdownloader', 'normalizeIds: no valid ids', linkIds);
    }
    return numeric;
  }

  private async sendJDCommand(endpoint: string, params: any[]): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      logger.info('jdownloader', `[MyJD] Command ${endpoint} params:`, JSON.stringify(params));

      const jdData = {
        url: endpoint,
        params: params.map((p) => JSON.stringify(p)),
        apiVer: 1,
        rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('jdownloader', `[MyJD] Command ${endpoint} failed:`, response.status, errorText.substring(0, 200));
        try {
          const decrypted = this.decryptAES(errorText, this.deviceEncryptionToken!);
          logger.error('jdownloader', `[MyJD] Command ${endpoint} decrypted error:`, JSON.stringify(decrypted));
          const message = (decrypted && (decrypted.data || decrypted.src || decrypted.message))
            ? JSON.stringify(decrypted)
            : `HTTP ${response.status}`;
          throw new Error(message);
        } catch (e) {
          logger.error('jdownloader', '[MyJD] Could not decrypt command error');
          throw new Error(`HTTP ${response.status}`);
        }
      }

      return true;
    } catch (error) {
      logger.error('jdownloader', `[MyJD] Command ${endpoint} error:`, error);
      throw error;
    }
  }

  async pauseDownloads(linkIds: Array<string | number>): Promise<boolean> {
    const ids = this.normalizeIds(linkIds);
    if (!ids.length) return false;
    // Use setEnabled with false to pause specific links
    return this.sendJDCommand('/downloadsV2/setEnabled', [false, ids, []]);
  }

  async resumeDownloads(linkIds: Array<string | number>): Promise<boolean> {
    const ids = this.normalizeIds(linkIds);
    if (!ids.length) return false;
    // Start specific links immediately and ensure controller is running
    const forced = await this.sendJDCommand('/downloadsV2/forceDownload', [ids, []]);
    const engine = await this.sendJDCommand('/downloadcontroller/start', []);
    return forced && engine;
  }

  async moveToDownloadList(linkIds: Array<string | number>, packageIds?: Array<string | number>): Promise<boolean> {
    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;
    return this.sendJDCommand('/linkgrabberv2/moveToDownloadlist', [ids, pkgIds]);
  }

  async removeLinkGrabberLinks(linkIds: Array<string | number>, packageIds?: Array<string | number>): Promise<boolean> {
    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;
    return this.sendJDCommand('/linkgrabberv2/removeLinks', [ids, pkgIds]);
  }

  async deleteDownloads(linkIds: Array<string | number>, deleteFiles = false, packageIds?: Array<string | number>): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;

    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}/downloadsV2/cleanup`;

      // Mode: REMOVE_LINKS_AND_DELETE_FILES to delete files from disk
      //       REMOVE_LINKS_ONLY to just remove from download list
      const mode = deleteFiles ? 'REMOVE_LINKS_AND_DELETE_FILES' : 'REMOVE_LINKS_ONLY';

      logger.info('jdownloader', `[MyJD] Command /downloadsV2/cleanup params:`, {
        linkIds: ids,
        packageIds: pkgIds,
        mode,
        deleteFiles
      });

      // Parameters for cleanup endpoint (in order):
      // 1. linkIds (long[])
      // 2. packageIds (long[])
      // 3. action (Action) - "DELETE_FINISHED"
      // 4. mode (Mode) - "REMOVE_LINKS_AND_DELETE_FILES" or "REMOVE_LINKS_ONLY"
      // 5. selectionType (SelectionType) - "SELECTED"
      const jdData = {
        url: '/downloadsV2/cleanup',
        params: [ids, pkgIds, 'DELETE_FINISHED', mode, 'SELECTED'],
        apiVer: 1,
        rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MyJD] Command /downloadsV2/cleanup failed:`, response.status);
        try {
          const decrypted = this.decryptAES(errorText, this.deviceEncryptionToken!);
          console.error(`[MyJD] Cleanup decrypted error:`, JSON.stringify(decrypted));
          throw new Error(JSON.stringify(decrypted));
        } catch (e) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      return true;
    } catch (error) {
      console.error(`[MyJD] Command cleanup error:`, error);
      throw error;
    }
  }

  async setDownloadPath(linkIds: Array<string | number>, path: string, packageIds?: Array<string | number>, source?: 'linkgrabber' | 'downloads'): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;

    // Use correct endpoint based on source
    const endpoint = source === 'linkgrabber'
      ? '/linkgrabberv2/setDownloadDirectory'
      : '/downloadsV2/setDownloadDirectory';

    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}${endpoint}`;

      console.log(`[MyJD] Command ${endpoint} params:`, { directory: path, packageIds: pkgIds, source });

      // Only directory and packageIds as query parameters (per official docs)
      const query = `?directory=${encodeURIComponent(path)}&packageIds=${JSON.stringify(pkgIds)}`;

      // Body contains empty params array (no linkIds needed)
      const jdData = {
        url: `${endpoint}${query}`,
        params: [], // Empty params as per official documentation
        apiVer: 1,
        rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MyJD] Command ${endpoint} failed:`, response.status, errorText.substring(0, 200));
        try {
          const decrypted = this.decryptAES(errorText, this.deviceEncryptionToken!);
          console.error(`[MyJD] Command ${endpoint} decrypted error:`, JSON.stringify(decrypted));
          throw new Error(JSON.stringify(decrypted));
        } catch (e) {
          console.error('[MyJD] Could not decrypt command error');
          throw new Error(`HTTP ${response.status}`);
        }
      }

      return true;
    } catch (error) {
      console.error(`[MyJD] Command ${endpoint} error:`, error);
      throw error;
    }
  }

  async forceExtract(linkIds: Array<string | number>, packageIds?: Array<string | number>): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;

    try {
      const rid = Date.now();
      const action = `/t_${this.sessionToken}_${this.deviceId}/extraction/startExtractionNow`;

      console.log(`[MyJD] Command /extraction/startExtractionNow params:`, { linkIds: ids, packageIds: pkgIds });

      // linkIds and packageIds go as query parameters
      const query = `?linkIds=${JSON.stringify(ids)}&packageIds=${JSON.stringify(pkgIds)}`;

      // Body contains empty params since query params are in URL
      const jdData = {
        url: `/extraction/startExtractionNow${query}`,
        params: [],
        apiVer: 1,
        rid,
      };

      const encryptedBody = this.encryptAES(JSON.stringify(jdData), this.deviceEncryptionToken!);

      const response = await fetch(`${this.baseUrl}${action}${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/aesjson; charset=utf-8',
        },
        body: encryptedBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MyJD] Command /extraction/startExtractionNow failed:`, response.status, errorText.substring(0, 200));
        try {
          const decrypted = this.decryptAES(errorText, this.deviceEncryptionToken!);
          console.error(`[MyJD] Command /extraction/startExtractionNow decrypted error:`, JSON.stringify(decrypted));
          throw new Error(JSON.stringify(decrypted));
        } catch (e) {
          console.error('[MyJD] Could not decrypt command error');
          throw new Error(`HTTP ${response.status}`);
        }
      }

      return true;
    } catch (error) {
      console.error(`[MyJD] Command /extraction/startExtractionNow error:`, error);
      throw error;
    }
  }

  async setExtractAfterDownload(linkIds: Array<string | number>, packageIds?: Array<string | number>): Promise<boolean> {
    if (!this.sessionToken || !this.deviceId || !this.deviceEncryptionToken) {
      throw new Error('Not authenticated');
    }

    const ids = this.normalizeIds(linkIds);
    const pkgIds = packageIds ? this.normalizeIds(packageIds) : [];
    if (!ids.length && !pkgIds.length) return false;

    try {
      logger.info('jdownloader', 'setExtractAfterDownload: setting extract-after for', { ids, pkgIds });
      const rid = Date.now();
      const getAction = `/t_${this.sessionToken}_${this.deviceId}/extraction/getArchiveInfo`;

      const jdDataGet = {
        url: '/extraction/getArchiveInfo',
        params: [JSON.stringify(ids), JSON.stringify(pkgIds)],
        apiVer: 1,
        rid,
      };

      const encryptedBodyGet = this.encryptAES(JSON.stringify(jdDataGet), this.deviceEncryptionToken!);
      const responseGet = await fetch(`${this.baseUrl}${getAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/aesjson; charset=utf-8' },
        body: encryptedBodyGet,
      });
      if (!responseGet.ok) {
        const errorText = await responseGet.text();
        logger.warn('jdownloader', `getArchiveInfo failed: ${responseGet.status}`, errorText.substring(0, 200));
        logger.info('jdownloader', 'But returning true anyway - archives may be created after download completes');
        // Return true anyway - might not have archives yet if still downloading
        return true;
      }
      const encryptedResponse = await responseGet.text();
      const data = this.decryptAES(encryptedResponse, this.deviceEncryptionToken!);
      const archives: Array<{ archiveId: string }> = Array.isArray(data?.data) ? data.data : [];
      console.log('[MyJD] Found', archives.length, 'archives for auto-extract');

      if (!archives.length) {
        console.log('[MyJD] No archives found yet (download still in progress?) - setting auto-extract will apply when archives appear');
        return true;
      }

      // Set autoExtract=true for each archive
      for (const a of archives) {
        console.log('[MyJD] Setting autoExtract=true for archive', a.archiveId);
        const ok = await this.sendJDCommand('/extraction/setArchiveSettings', [String(a.archiveId), { autoExtract: true }]);
        if (!ok) {
          console.warn('[MyJD] Failed to set autoExtract for archive', a.archiveId);
        }
      }

      return true;
    } catch (error) {
      logger.error('jdownloader', 'setExtractAfterDownload error', error);
      return false;
    }
  }
}

// ============================================================================
// UNIFIED JDOWNLOADER CLIENT (tries local first, fallback to remote)
// ============================================================================

export class JDownloaderClient {
  private localService: JDownloaderLocalService;
  private remoteService: JDownloaderService;
  private preferredMethod: 'local' | 'remote' = 'local';

  constructor(
    remoteEmail: string,
    remotePassword: string,
    remoteDeviceName: string,
    localHost?: string,
    localPort?: number
  ) {
    this.localService = new JDownloaderLocalService(localHost, localPort);
    this.remoteService = new JDownloaderService(
      remoteEmail,
      remotePassword,
      remoteDeviceName
    );
  }

  async testConnections(): Promise<{
    local: boolean;
    remote: boolean;
  }> {
    console.log('[JDClient] Testing connections...');

    const localAvailable = await this.localService.isAvailable();
    console.log(
      `[JDClient] Local API (deprecated): ${localAvailable ? '✅' : '❌'}`
    );

    const remoteAuthenticated = await this.remoteService.authenticate();
    console.log(
      `[JDClient] Remote API (MyJD): ${remoteAuthenticated ? '✅' : '❌'}`
    );

    // Set preferred method based on availability
    if (localAvailable) {
      this.preferredMethod = 'local';
    } else if (remoteAuthenticated) {
      this.preferredMethod = 'remote';
    }

    return {
      local: localAvailable,
      remote: remoteAuthenticated,
    };
  }

  async addLinks(urls: string[], packageName?: string, autostart?: boolean, autoExtract?: boolean): Promise<{
    success: boolean;
    method: 'local' | 'remote' | 'none';
    error?: string;
  }> {
    console.log(`[JDClient] Adding ${urls.length} link(s) via ${this.preferredMethod}...`);

    // Try preferred method first
    if (this.preferredMethod === 'local') {
      const success = await this.localService.addLinks(urls, packageName, autostart, autoExtract);
      if (success) {
        return { success: true, method: 'local' };
      }
      console.log('[JDClient] Local failed, trying remote...');
    }

    // Try remote as fallback
    const remoteSuccess = await this.remoteService.addLinks(urls, packageName, autostart, autoExtract);
    if (remoteSuccess) {
      return { success: true, method: 'remote' };
    }

    return {
      success: false,
      method: 'none',
      error: 'Both local and remote connections failed',
    };
  }

  async getStatus(): Promise<any> {
    if (this.preferredMethod === 'local') {
      const status = await this.localService.getStatus();
      if (status) return { local: status };
    }

    const status = await this.remoteService.getDeviceStatus();
    return { remote: status };
  }
}