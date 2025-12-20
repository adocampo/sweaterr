import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Logout user by clearing the auth cookie
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.set('blazarr-auth', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });

  return response;
}
