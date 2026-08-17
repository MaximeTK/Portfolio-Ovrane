import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 503 });
  }
}
