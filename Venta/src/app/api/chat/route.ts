/**
 * Route API pour le chat - max 5 fonctions, max 20 lignes
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractUserInfo, callBackend, handleBackendError, processBackendResponse } from './helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, currentUserId } = body;
    
    if (!prompt || typeof prompt !== 'string') {
      console.error('❌ [NEXT API] Prompt manquant ou invalide');
      return NextResponse.json({ error: 'Prompt requis' }, { status: 400 });
    }

    const { userIp, userAgent } = extractUserInfo(request);
    
    let response;
    try {
      const result = await callBackend(prompt, userIp, userAgent, currentUserId);
      response = result.response;
    } catch (error) {
      return NextResponse.json(
        { 
          error: 'Impossible de contacter le backend',
          details: error instanceof Error ? error.message : String(error)
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
        error: 'Erreur interne du serveur',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}
