import { NextRequest, NextResponse } from 'next/server';
import { proxyJson } from '@/lib/api/proxy';
import { API_ERRORS } from '@/lib/messages';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const userId = q.get('userId');
  if (!userId) {
    return NextResponse.json({ error: API_ERRORS.userIdRequired }, { status: 400 });
  }
  const params = new URLSearchParams({
    userId,
    limit: q.get('limit') || '50',
    skip: q.get('skip') || '0',
  });
  return proxyJson(`/api/chat/history?${params}`);
}
