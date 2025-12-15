import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '../helpers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit') || '50';
    const skip = searchParams.get('skip') || '0';

    if (!userId) {
      return NextResponse.json({ error: 'UserId required' }, { status: 400 });
    }

    const BACKEND_URL = getBackendUrl();
    const response = await fetch(`${BACKEND_URL}/api/chat/history?userId=${userId}&limit=${limit}&skip=${skip}`, {
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
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

