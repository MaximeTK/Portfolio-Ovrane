/**
 * Route API pour le chat - max 5 fonctions, max 20 lignes
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractUserInfo, callBackend, handleBackendError, processBackendResponse } from './helpers';
import { API_ERRORS } from '@/lib/messages';

export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    const body = await request.json();
    const { prompt, currentUserId, isEphemeral, currentUrl } = body;
    
    if (!prompt || typeof prompt !== 'string') {
      console.error('❌ [NEXT API] Prompt manquant ou invalide');
      return NextResponse.json({ error: API_ERRORS.promptRequired }, { status: 400 });
    }

    const { userIp, userAgent } = extractUserInfo(request);
    
    let response;
    try {
      const result = await callBackend(prompt, userIp, userAgent, currentUserId, isEphemeral, currentUrl);
      response = result.response;
    } catch (error) {
      return NextResponse.json(
        { 
          error: API_ERRORS.backendUnreachable,
          ...(isProd ? {} : { details: error instanceof Error ? error.message : String(error) })
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      return await handleBackendError(response);
    }

    return await processBackendResponse(response);
  } catch (error) {
    console.error('❌ [NEXT API] Erreur globale:', error);
    return NextResponse.json(
      { 
        error: API_ERRORS.internalServerError,
        ...(isProd ? {} : { details: error instanceof Error ? error.message : String(error) })
      }, 
      { status: 500 }
    );
  }
}
