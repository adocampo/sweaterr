import { NextRequest, NextResponse } from 'next/server';

// POST /api/arr/notify - Mock notification handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Mock notification received:', body);
    
    return NextResponse.json({
      success: true,
      message: 'Notification processed (mock)',
    });
  } catch (error) {
    console.error('Error in notification:', error);
    return NextResponse.json(
      { success: false, error: 'Notification failed' },
      { status: 500 }
    );
  }
}