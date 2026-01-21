import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Local Prisma client to avoid undefined delegates in hot-reload scenarios
const prisma = new PrismaClient();
const userDelegate = () => (prisma as any).user as any;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set. This is required for authentication.');
}
const JWT_EXPIRATION = '7d';

export interface UserPayload {
    id: string;
    email: string;
    role: 'admin' | 'user';
}

export interface DecodedToken extends UserPayload {
    iat: number;
    exp: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

/**
 * Compare a password with its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 */
export function generateToken(user: UserPayload): string {
    return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): DecodedToken | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
        console.log('[Auth] Token verified successfully:', { id: decoded.id, role: decoded.role });
        return decoded;
    } catch (error) {
        console.error('[Auth] Token verification error:', error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Check if setup is needed (no users exist)
 */
export async function isSetupNeeded(): Promise<boolean> {
    const userCount = await userDelegate().count();
    return userCount === 0;
}

/**
 * Create the first admin user during setup
 */
export async function setupFirstAdmin(
    username: string,
    email: string,
    password: string
): Promise<{ success: boolean; message: string; user?: any }> {
    try {
        // Check if any user exists
        const existingUsers = await userDelegate().count();
        if (existingUsers > 0) {
            return {
                success: false,
                message: 'Setup already completed. Users already exist.',
            };
        }

        // Validate username
        if (!username || username.length < 3) {
            return {
                success: false,
                message: 'Username must be at least 3 characters long',
            };
        }

        // Validate email (optional but if provided, must be valid)
        if (email && !email.includes('@')) {
            return {
                success: false,
                message: 'Invalid email address',
            };
        }

        // Validate password
        if (!password || password.length < 8) {
            return {
                success: false,
                message: 'Password must be at least 8 characters long',
            };
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create admin user
        const user = await userDelegate().create({
            data: {
                username,
                email: email || `${username}@sweaterr.local`,
                passwordHash,
                role: 'admin',
                language: 'es',
                theme: 'dark',
                isFirstSetupDone: true,
            },
        });

        return {
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        };
    } catch (error) {
        console.error('[Setup] Error creating first admin:', error);
        return {
            success: false,
            message: 'Failed to create admin user',
        };
    }
}

/**
 * Login user and return token
 */
export async function loginUser(
    usernameOrEmail: string,
    password: string
): Promise<{ success: boolean; message: string; user?: any; token?: string }> {
    try {
        // Find user by username or email
        const user = await userDelegate().findFirst({
            where: {
                OR: [
                    { username: usernameOrEmail },
                    { email: usernameOrEmail },
                ],
            },
        });

        if (!user) {
            return {
                success: false,
                message: 'Invalid username/email or password',
            };
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            return {
                success: false,
                message: 'Invalid username/email or password',
            };
        }

        // Generate token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role as 'admin' | 'user',
        });

        return {
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                language: user.language,
                theme: user.theme,
            },
            token,
        };
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return {
            success: false,
            message: 'Login failed',
        };
    }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<any | null> {
    try {
        const user = await userDelegate().findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                role: true,
                language: true,
                theme: true,
                createdAt: true,
            },
        });
        return user;
    } catch (error) {
        console.error('[Auth] Get user error:', error);
        return null;
    }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
    userId: string,
    data: { language?: string; theme?: string }
): Promise<{ success: boolean; message: string; user?: any }> {
    try {
        const user = await userDelegate().update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                role: true,
                language: true,
                theme: true,
            },
        });

        return {
            success: true,
            message: 'Preferences updated',
            user,
        };
    } catch (error) {
        console.error('[Auth] Update preferences error:', error);
        return {
            success: false,
            message: 'Failed to update preferences',
        };
    }
}

/**
 * Extract token from request headers or cookies
 */
export function extractToken(
    headers: Record<string, string | string[] | undefined>,
    cookies?: Record<string, string>
): string | null {
    // Try Authorization header first
    const authHeader = headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
        const match = authHeader.match(/Bearer\s+(\S+)/);
        if (match) {
            return match[1];
        }
    }

    // Try cookies
    if (cookies?.['sweaterr-auth']) {
        return cookies['sweaterr-auth'];
    }

    return null;
}
