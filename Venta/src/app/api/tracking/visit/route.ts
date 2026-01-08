import { NextRequest, NextResponse } from 'next/server';
import { extractUserInfo, getBackendUrl } from '../../chat/helpers';
import { API_ERRORS } from '@/lib/messages';

export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    const body = await request.json();
    const { userId, link } = body;

    if (!userId || !link) {
      return NextResponse.json({ error: API_ERRORS.badRequest }, { status: 400 });
    }

    const { userIp, userAgent } = extractUserInfo(request);
    const BACKEND_URL = getBackendUrl();

    // Appel au backend
    const response = await fetch(`${BACKEND_URL}/api/tracking/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, link, userIp, userAgent }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Erreur route tracking:', error);
    return NextResponse.json(
      { error: API_ERRORS.internalServerError, ...(isProd ? {} : { details: error instanceof Error ? error.message : String(error) }) },
      { status: 500 }
    );
  }
}

