/**
 * Palettes de couleurs disponibles pour le fond du site
 */

export interface ColorPalette {
  id: string;
  name: string;
  topColor: string;
  bottomColor: string;
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  default: {
    id: 'default',
    name: 'Défaut (Sombre)',
    topColor: '#121219',
    bottomColor: '#0a0a0d',
  },
  argenté: {
    id: 'argenté',
    name: 'argenté',
    topColor: '#8A8A8A',
    bottomColor: '#495656',
  },
  gris: {
    id: 'gris',
    name: 'gris',
    topColor: '#667B97',
    bottomColor: '#636C71',
  },
  noir: {
    id: 'noir',
    name: 'noir',
    topColor: '#000000',
    bottomColor: '#353535',
  },
  doré: {
    id: 'doré',
    name: 'doré',
    topColor: '#251E12',
    bottomColor: '#847144',
  },
  jaune: {
    id: 'jaune',
    name: 'jaune',
    topColor: '#F7C551',
    bottomColor: '#754E00',
  },
  orange: {
    id: 'orange',
    name: 'orange',
    topColor: '#F79451',
    bottomColor: '#752700',
  },
  rouge: {
    id: 'rouge',
    name: 'rouge',
    topColor: '#BB4848',
    bottomColor: '#3D0000',
  },
  ecarlate: {
    id: 'ecarlate',
    name: 'ecarlate',
    topColor: '#24000A',
    bottomColor: '#780022',
  },
  vert_clair: {
    id: 'vert_clair',
    name: 'vert clair',
    topColor: '#27524C',
    bottomColor: '#58B460',
  },
  forêt: {
    id: 'forêt',
    name: 'forêt',
    topColor: '#001315',
    bottomColor: '#244925',
  },
  marée: {
    id: 'marée',
    name: 'marée',
    topColor: '#001315',
    bottomColor: '#244049',
  },
  feuille: {
    id: 'feuille',
    name: 'feuille',
    topColor: '#798B43',
    bottomColor: '#174100',
  },
  aqua: {
    id: 'aqua',
    name: 'aqua',
    topColor: '#17A0AE',
    bottomColor: '#002A38',
  },
  ocean: {
    id: 'ocean',
    name: 'ocean',
    topColor: '#1758AE',
    bottomColor: '#000638',
  },
  hopa: {
    id: 'hopa',
    name: 'hopa',
    topColor: '#000000',
    bottomColor: '#6E8FFE',
  },
  gris_ciel: {
    id: 'gris_ciel',
    name: 'gris ciel',
    topColor: '#485176',
    bottomColor: '#8592C4',
  },
  spectre: {
    id: 'spectre',
    name: 'spectre',
    topColor: '#241E47',
    bottomColor: '#5948AD',
  },
  mauve: {
    id: 'mauve',
    name: 'mauve',
    topColor: '#12002B',
    bottomColor: '#40005B',
  },
  rose: {
    id: 'rose',
    name: 'rose',
    topColor: '#832B77',
    bottomColor: '#9367A6',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'cyberpunk',
    topColor: '#5117AE',
    bottomColor: '#000638',
  },
  melon: {
    id: 'melon',
    name: 'melon',
    topColor: '#7A2D65',
    bottomColor: '#AB3F41',
  },
  goyavier: {
    id: 'goyavier',
    name: 'goyavier',
    topColor: '#783434',
    bottomColor: '#451919',
  },
  marron: {
    id: 'marron',
    name: 'marron',
    topColor: '#241F16',
    bottomColor: '#311E00',
  },
  vin: {
    id: 'vin',
    name: 'vin',
    topColor: '#110105',
    bottomColor: '#20000A',
  }
};

export function getDefaultPalette(): ColorPalette {
  return COLOR_PALETTES.default;
}

