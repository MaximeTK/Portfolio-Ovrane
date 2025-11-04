/**
 * Helpers pour la route API chat - max 5 fonctions, max 20 lignes
 */
import { NextResponse } from 'next/server';

/**
 * Extrait les informations utilisateur de la requête
 */
export function extractUserInfo(request: any) {
  const userIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                 request.headers.get('x-real-ip') || 
                 request.ip || 
                 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  return { userIp, userAgent };
}

/**
 * Appelle le backend
 */
export async function callBackend(prompt: string, userIp: string, userAgent: string, currentUserId: string | undefined) {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        userIp: userIp,
        userAgent: userAgent,
        currentUserId: currentUserId
      }),
      signal: AbortSignal.timeout(60000)
    });
    return { response, BACKEND_URL };
  } catch (fetchError) {
    console.error('❌ [NEXT API] Erreur de connexion au backend:', fetchError);
    throw new Error(`Backend ${BACKEND_URL} non accessible: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }
}

/**
 * Gère les erreurs du backend
 */
export async function handleBackendError(response: Response) {
  console.error(`❌ [NEXT API] Backend a retourné une erreur: ${response.status}`);
  let errorData;
  try {
    errorData = await response.json();
    console.error('📄 [NEXT API] Détails erreur backend:', errorData);
  } catch {
    const text = await response.text();
    console.error('📄 [NEXT API] Erreur backend (text):', text);
    errorData = { error: text };
  }
  
  if (response.status === 500 && errorData.details?.includes('API')) {
    return NextResponse.json(
      { 
        error: 'Configuration du backend incorrecte',
        details: 'Vérifiez la clé API OpenAI dans venta-backend/.env'
      }, 
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { 
      error: errorData.error || `Erreur Backend: ${response.status}`,
      details: errorData.details || 'Erreur inconnue du backend'
    }, 
    { status: response.status }
  );
}

/**
 * Traite la réponse du backend
 */
export async function processBackendResponse(response: Response) {
  const data = await response.json();
  if (!data.reply) {
    console.error('❌ [NEXT API] Pas de reply dans la réponse backend!', data);
  }
  
  return NextResponse.json({ 
    reply: data.reply,
    commands: data.commands || [],
    rawResponse: data.rawResponse,
    userProfile: data.userProfile || null,
    activeUserId: data.activeUserId,
    tts: data.tts || null
  });
}

