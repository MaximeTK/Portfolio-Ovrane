import { NextRequest, NextResponse } from 'next/server';
import { forward } from '@/lib/proxy';
import { REDIRECT_TARGETS, isValidJeton } from '@/lib/redirections';

// CV envoyé avec la candidature du jeton, lu dans la base partagée ; à défaut, le CV générique du portfolio.
export async function GET(request: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  if (isValidJeton(jeton)) {
    try {
      const response = await forward(request, `/api/illusion/cv/${jeton}`);
      if (response?.ok) {
        return new NextResponse(await response.arrayBuffer(), {
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/pdf',
            'Content-Disposition': 'inline; filename="CV.pdf"',
            'Cache-Control': 'private, no-store',
          },
        });
      }
    } catch (error) {
      console.error('[cv] backend injoignable:', error);
    }
  }
  return NextResponse.redirect(new URL(REDIRECT_TARGETS.cv, request.url));
}
