import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '../helpers';
import { API_ERRORS } from '@/lib/messages';

export async function GET(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit') || '50';
    const skip = searchParams.get('skip') || '0';

    if (!userId) {
      return NextResponse.json({ error: API_ERRORS.userIdRequired }, { status: 400 });
    }

    const BACKEND_URL = getBackendUrl();
    const response = await fetch(
      `${BACKEND_URL}/api/chat/history?userId=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}&skip=${encodeURIComponent(skip)}`,
      {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [NEXT API] Error fetching history:', error);
    return NextResponse.json(
      { error: API_ERRORS.internalServerError, ...(isProd ? {} : { details: error instanceof Error ? error.message : String(error) }) },
      { status: 500 }
    );
  }
}

