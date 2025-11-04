import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API pour exposer la liste des assets disponibles au backend
 * GET /api/frontend/assets
 */
export async function GET() {
  try {
    const assetsDir = path.join(process.cwd(), 'public', 'assets');
    
    if (!fs.existsSync(assetsDir)) {
      return NextResponse.json({ 
        success: false,
        error: 'Dossier assets non trouvé',
        assets: [] 
      });
    }
    
    const files = fs.readdirSync(assetsDir);
    
    // Extensions valides
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.webm', '.lottie', '.json'];
    
    // Filtrer les fichiers - retourner directement les noms de fichiers
    const assetsList: string[] = [];
    
    files.forEach(filename => {
      const ext = path.extname(filename).toLowerCase();
      if (validExtensions.includes(ext)) {
        assetsList.push(filename);
      }
    });
    
    //console.log(`📦 [FRONTEND API] ${assetsList.length} assets exposés`);
    
    return NextResponse.json({ 
      success: true,
      count: assetsList.length,
      assets: assetsList
    });
    
  } catch (error) {
    console.error('❌ [FRONTEND API] Erreur lors du scan des assets:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      assets: [] 
    }, { status: 500 });
  }
}

