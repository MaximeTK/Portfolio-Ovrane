import { NextRequest, NextResponse } from 'next/server';
import { proxyJson, clientInfo } from '@/lib/api/proxy';
import { API_ERRORS } from '@/lib/messages';

export async function POST(request: NextRequest) {
  const { userId, link } = await request.json();
  if (!userId || !link) {
    return NextResponse.json({ error: API_ERRORS.badRequest }, { status: 400 });
  }
  return proxyJson('/api/tracking/visit', {
    method: 'POST',
    body: { userId, link, ...clientInfo(request) },
  });
}
