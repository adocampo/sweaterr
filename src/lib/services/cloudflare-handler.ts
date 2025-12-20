import { chromium, Browser, BrowserContext, Page } from 'playwright';
import axios from 'axios';
import { FlareSolverrClient } from './flaresolverr-client';

export class CloudflareHandler {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async initialize(): Promise<void> {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }
    }

    async getPage(): Promise<Page> {
        if (!this.page) {
            await this.initialize();
            if (!this.browser) throw new Error('Browser not initialized');

            if (!this.context) {
                this.context = await this.browser.newContext({
                    userAgent:
                        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    viewport: { width: 1280, height: 800 },
                    locale: 'es-ES',
                    timezoneId: 'Europe/Madrid',
                });

                await this.context.addInitScript(() => {
                    try {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es'] });
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                    } catch { }
                });

                await this.context.setExtraHTTPHeaders({
                    'accept-language': 'es-ES,es;q=0.9',
                });
            }

            this.page = await this.context.newPage();
        }
        return this.page;
    }

    async loginToForum(
        baseUrl: string,
        loginUrl: string,
        username: string,
        password: string,
        flaresolverrUrl?: string,
        usernameFieldSelector: string = 'input[name="username"]',
        passwordFieldSelector: string = 'input[name="password"]',
        submitButtonSelector: string = 'button[type="submit"], input[type="submit"]'
    ): Promise<{ success: boolean; cookies: string; error?: string }> {
        try {

            // Prefer FlareSolverr if available
            flaresolverrUrl = flaresolverrUrl || process.env.FLARESOLVERR_URL || process.env.NEXT_PUBLIC_FLARESOLVERR_URL;
            if (flaresolverrUrl) {
                console.log(`[FlareSolverr] Using endpoint: ${flaresolverrUrl}`);
                const client = new FlareSolverrClient(flaresolverrUrl);
                // Warm up base URL to obtain CF cookies
                const warm = await client.request(baseUrl, 'GET');
                const cookieHeader = FlareSolverrClient.cookiesToHeader(warm.cookies);
                const headers = { ...warm.headers, Cookie: cookieHeader, 'Accept-Language': 'es-ES,es;q=0.9' };

                // Perform vBulletin login POST via FlareSolverr
                const postData = {
                    do: 'login',
                    vb_login_username: username,
                    vb_login_password: password,
                    s: '',
                    securitytoken: 'guest',
                    url: `${baseUrl}/forum.php`,
                    cookieuser: '1',
                };

                const login = await client.request(`${baseUrl}${loginUrl}`, 'POST', postData);
                const loginHtml = login.response || '';

                // Check for vBulletin login error messages in response
                if (loginHtml.includes('nombre de usuario o contraseña no válidos') ||
                    loginHtml.includes('incorrect') ||
                    loginHtml.includes('invalid username or password') ||
                    loginHtml.includes('has introducido un nombre de usuario o contraseña')) {
                    console.log('[FlareSolverr] ✗ Invalid credentials detected in response');
                    return {
                        success: false,
                        cookies: '',
                        error: 'Credenciales incorrectas',
                    };
                }

                const finalCookies = FlareSolverrClient.cookiesToHeader(login.cookies);

                // Verify by checking if we have session cookies (vBulletin uses 'bb' prefix)
                const hasSessionCookie = login.cookies.some(c =>
                    c.name.startsWith('bb') || c.name.includes('session') || c.name.includes('userid')
                );

                if (!hasSessionCookie && loginHtml.length > 0) {
                    console.log('[FlareSolverr] ✗ No session cookies found after login');
                    return {
                        success: false,
                        cookies: '',
                        error: 'No se obtuvieron cookies de sesión. Verifica las credenciales.',
                    };
                }

                if (finalCookies.length > 0) {
                    console.log('[FlareSolverr] ✓ Login successful, session cookies acquired');
                    return { success: true, cookies: finalCookies };
                }

                return {
                    success: false,
                    cookies: '',
                    error: 'No se pudo obtener cookies tras el login con FlareSolverr',
                };
            }

            const page = await this.getPage();

            // First hit the base URL to allow Cloudflare to set cookies
            console.log(`[Playwright] Warming up base URL for Cloudflare: ${baseUrl}`);
            await page.goto(`${baseUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });

            // If Cloudflare Turnstile is present, wait for it to complete
            const cfInput = page.locator('input[name="cf-turnstile-response"]');
            const cfInputCount = await cfInput.count();
            if (cfInputCount > 0) {
                console.log('[Playwright] Cloudflare Turnstile detected. Waiting for completion...');
                try {
                    await page.waitForFunction(
                        () => {
                            const el = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
                            return !!el && !!el.value && el.value.length > 0;
                        },
                        undefined,
                        { timeout: 25000 }
                    );
                    console.log('[Playwright] Turnstile token present. Waiting for stabilization...');
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                } catch {
                    console.log('[Playwright] Turnstile did not complete in time, proceeding anyway.');
                }
            }

            console.log(`[Playwright] Navigating to login page: ${baseUrl}${loginUrl}`);
            await page.goto(`${baseUrl}${loginUrl}`, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });

            // Additional wait if Turnstile appears on the login page
            const cfLoginCount = await page.locator('input[name="cf-turnstile-response"]').count();
            if (cfLoginCount > 0) {
                console.log('[Playwright] Turnstile present on login page. Waiting briefly...');
                await page.waitForTimeout(2000);
                // If only Turnstile is present and no inputs after a short wait, try one more warm-up cycle
                const inputCount = await page.locator('input').count();
                if (inputCount <= 1) {
                    console.log('[Playwright] Only Turnstile detected. Retrying warm-up flow...');
                    await page.goto(`${baseUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                    await page.waitForTimeout(2000);
                    await page.goto(`${baseUrl}${loginUrl}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                }
            }

            // Debug: print all form inputs on the page
            const inputs = await page.locator('input').all();
            console.log(`[Playwright] Found ${inputs.length} input fields on page`);

            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                const name = await input.getAttribute('name');
                const type = await input.getAttribute('type');
                const id = await input.getAttribute('id');
                console.log(`[Playwright]   Input ${i}: name="${name}", type="${type}", id="${id}"`);
            }

            // Try to find username field - be flexible with selectors
            const usernameSelectors = [
                '#vb_login_username',
                'input[name="username"]',
                'input[name="vb_login_username"]',
                'input[name="login"]',
                'input[name="user"]',
                'input[name="email"]',
                'input#username',
                'input#vb_login_username',
                'input#login',
                'input[type="text"]',
                'input:first-of-type',
            ];

            let usernameField: any = null;
            for (const selector of usernameSelectors) {
                const field = page.locator(selector).first();
                if (await field.count() > 0 && await field.isVisible()) {
                    usernameField = field;
                    console.log(`[Playwright] Found username field: ${selector}`);
                    break;
                }
            }

            if (!usernameField) {
                return {
                    success: false,
                    cookies: '',
                    error: 'No se encontró el campo de usuario en el formulario',
                };
            }

            await usernameField.fill(username);
            console.log('[Playwright] Filled username field');

            // Find password field
            const passwordSelectors = [
                '#vb_login_password',
                'input[name="password"]',
                'input[name="vb_login_password"]',
                'input[name="pwd"]',
                'input[name="pass"]',
                'input#password',
                'input#vb_login_password',
                'input#pwd',
                'input[type="password"]',
            ];

            let passwordField: any = null;
            for (const selector of passwordSelectors) {
                const field = page.locator(selector).first();
                if (await field.count() > 0 && await field.isVisible()) {
                    passwordField = field;
                    console.log(`[Playwright] Found password field: ${selector}`);
                    break;
                }
            }

            if (!passwordField) {
                return {
                    success: false,
                    cookies: '',
                    error: 'No se encontró el campo de contraseña en el formulario',
                };
            }

            await passwordField.fill(password);
            console.log('[Playwright] Filled password field');

            // Find and click submit button
            const submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Log in")',
                'button:has-text("Login")',
                'button:has-text("Entrar")',
                'button:has-text("Conectar")',
                'button:has-text("OK")',
                'input[name="submit"]',
                'input[name="s"]',
            ];

            let submitClicked = false;
            for (const selector of submitSelectors) {
                const button = page.locator(selector).first();
                if (await button.count() > 0 && await button.isVisible()) {
                    try {
                        await button.click();
                        console.log(`[Playwright] Clicked submit button: ${selector}`);
                        submitClicked = true;
                        break;
                    } catch (e) {
                        console.log(`[Playwright] Failed to click: ${selector}`);
                        continue;
                    }
                }
            }

            if (!submitClicked) {
                // Try submitting the closest form explicitly
                const form = page.locator('form[action*="login.php?do=login"], form[action*="do=login"]').first();
                if (await form.count() > 0) {
                    try {
                        await form.evaluate((node: HTMLFormElement) => node.submit());
                        console.log('[Playwright] Submitted form via evaluate()');
                        submitClicked = true;
                    } catch {
                        // Try pressing Enter as a last resort
                        await page.keyboard.press('Enter');
                        console.log('[Playwright] Pressed Enter to submit');
                    }
                } else {
                    await page.keyboard.press('Enter');
                    console.log('[Playwright] Pressed Enter to submit');
                }
            }

            // Wait for navigation after login
            await page.waitForTimeout(3000);

            // Check if login was successful by looking for logout link
            const logoutLinks = await page.locator('a[href*="logout"]').count();
            const userMenu = await page.locator('.user-menu, .username, .user-name, #logout, [class*="logout"], .userinfo').count();

            console.log(`[Playwright] Logout links: ${logoutLinks}, User menu elements: ${userMenu}`);

            if (logoutLinks > 0 || userMenu > 0) {
                console.log('[Playwright] ✓ Login successful - logout link/user menu found');

                // Extract cookies
                const cookies = await page.context().cookies();
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                return {
                    success: true,
                    cookies: cookieString,
                };
            }

            // Check for error messages
            const errorText = await page.locator('.error, [class*="error"], .standard_error .blockrow.restore').first().textContent();
            if (errorText && errorText.toLowerCase().includes('incorrecto')) {
                return {
                    success: false,
                    cookies: '',
                    error: 'Credenciales incorrectas',
                };
            }

            // If Turnstile is still the only input, guide the user
            const finalInputCount = await page.locator('input').count();
            if (finalInputCount === 1 && (await page.locator('input[name="cf-turnstile-response"]').count()) === 1) {
                return {
                    success: false,
                    cookies: '',
                    error:
                        'Cloudflare Turnstile bloquea el formulario. Inicia sesión manualmente en el navegador y pega las cookies en la configuración, o intenta de nuevo más tarde.',
                };
            }

            const pageUrl = page.url();
            console.log(`[Playwright] Page URL after login: ${pageUrl}`);
            console.log(`[Playwright] No logout indicators found. Login may have failed.`);

            return {
                success: false,
                cookies: '',
                error: 'No se puede confirmar que el login fue exitoso (Prueba FLARESOLVERR_URL)',
            };
        } catch (error: any) {
            console.error('[Playwright] Error:', error.message);
            return {
                success: false,
                cookies: '',
                error: `Error durante el login: ${error.message}`,
            };
        }
    }

    async close(): Promise<void> {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async getCookies(): Promise<string> {
        if (!this.page) return '';
        const cookies = await this.page.context().cookies();
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }
}
