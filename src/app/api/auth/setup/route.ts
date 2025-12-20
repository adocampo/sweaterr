import { NextRequest, NextResponse } from 'next/server';
import { isSetupNeeded, setupFirstAdmin } from '@/lib/services/auth';

/**
 * GET /api/auth/setup/status
 * Check if setup is needed
 */
export async function GET() {
  try {
    const setupNeeded = await isSetupNeeded();
    return NextResponse.json({
      success: true,
      setupNeeded,
    });
  } catch (error) {
    console.error('[Setup] Status check error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/setup
 * Create the first admin user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password, confirmPassword } = body;

    // Validate inputs
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Perform setup
    const result = await setupFirstAdmin(username, email || '', password);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[Setup] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Setup failed' },
      { status: 500 }
    );
  }
}
