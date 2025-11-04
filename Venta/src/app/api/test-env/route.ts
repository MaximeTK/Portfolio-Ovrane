import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    openai: process.env.OPENAI_API_KEY ? '✅ Présente' : '❌ Manquante',
    eleven: process.env.ELEVEN_API_KEY ? '✅ Présente' : '❌ Manquante',
    voice: process.env.ELEVEN_VOICE_ID ? '✅ Présente' : '❌ Manquante',
    openaiLength: process.env.OPENAI_API_KEY?.length || 0,
    elevenLength: process.env.ELEVEN_API_KEY?.length || 0,
    voiceId: process.env.ELEVEN_VOICE_ID || 'N/A'
  });
}
