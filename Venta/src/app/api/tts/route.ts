import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * Essaie Eleven Labs TTS
 */
async function tryElevenLabs(text: string): Promise<ArrayBuffer | null> {
  const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
  const ELEVEN_VOICE_ID = process.env.ELEVEN_VOICE_ID;
  
  if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID) {
    //console.log('⚠️ [TTS] Eleven Labs non configuré');
    return null;
  }

  try {
    //console.log('🎵 [TTS] Tentative avec Eleven Labs...');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TTS] Eleven Labs erreur:', response.status, errorText);
      
      // Si erreur 401 ou 402 = Plus de crédits
      if (response.status === 401 || response.status === 402) {
        console.warn('💳 [TTS] Plus de crédits Eleven Labs');
        return null;
      }
      
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    //console.log('✅ [TTS] Eleven Labs OK');
    return audioBuffer;
    
  } catch (error) {
    console.error('❌ [TTS] Eleven Labs exception:', error);
    return null;
  }
}

/**
 * Essaie OpenAI TTS (fallback)
 */
async function tryOpenAI(text: string): Promise<ArrayBuffer | null> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  //console.log('🔍 [TTS DEBUG] OPENAI_API_KEY présente:', !!OPENAI_API_KEY);
  //console.log('🔍 [TTS DEBUG] Clé commence par:', OPENAI_API_KEY?.substring(0, 10) || 'N/A');
  
  if (!OPENAI_API_KEY) {
    //console.log('⚠️ [TTS] OpenAI non configuré');
    //console.log('🔍 [TTS DEBUG] Variables env disponibles:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
    return null;
  }

  try {
    //console.log('🎵 [TTS] Tentative avec OpenAI TTS...');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova', // Voix féminine française
      input: text,
      speed: 1.0
    });

    const audioBuffer = await response.arrayBuffer();
    //console.log('✅ [TTS] OpenAI TTS OK');
    return audioBuffer;
    
  } catch (error) {
    console.error('❌ [TTS] OpenAI erreur:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 });
    }

    //console.log(`\n🎤 [TTS] Demande de synthèse vocale: "${text.substring(0, 50)}..."`);

    // Stratégie de fallback en cascade
    let audioBuffer: ArrayBuffer | null = null;
    let provider = 'none';
    
    // Tentative 1 : Eleven Labs
    audioBuffer = await tryElevenLabs(text);
    if (audioBuffer) {
      provider = 'elevenlabs';
    }
    
    // Tentative 2 : OpenAI TTS
    if (!audioBuffer) {
      //console.log('🔄 [TTS] Fallback vers OpenAI TTS...');
      audioBuffer = await tryOpenAI(text);
      if (audioBuffer) {
        provider = 'openai';
      }
    }
    
    // Tentative 3 : Fallback côté client (Web Speech API)
    if (!audioBuffer) {
      //console.log('🔄 [TTS] Fallback vers Web Speech API (client-side)...');
      return NextResponse.json({ 
        useClientTTS: true,
        text: text 
      }, { status: 200 });
    }

    // Retourner l'audio généré
    //console.log(`✅ [TTS] Audio généré avec ${provider}`);
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
        'X-TTS-Provider': provider
      },
    });
    
  } catch (error) {
    console.error('❌ [TTS] Erreur globale:', error);
    
    // En cas d'erreur totale, fallback client-side
    return NextResponse.json({ 
      useClientTTS: true,
      text: await request.json().then(body => body.text).catch(() => '')
    }, { status: 200 });
  }
}
