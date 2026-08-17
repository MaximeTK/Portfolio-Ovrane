import { NextRequest } from 'next/server';
import { proxyJson } from '@/lib/api/proxy';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return proxyJson(`/api/preferences/${encodeURIComponent(userId)}`);
}
