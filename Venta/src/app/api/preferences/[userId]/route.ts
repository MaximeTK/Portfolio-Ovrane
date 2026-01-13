import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(_request: NextRequest, context: { params: { userId: string } }) {
  try {
    const userId = context.params.userId;
    const response = await fetch(`${BACKEND_URL}/api/preferences/${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'preferences proxy error', details: msg }, { status: 500 });
  }
}


