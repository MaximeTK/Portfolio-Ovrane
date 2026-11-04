/** Palettes de couleurs du fond du site */

export interface ColorPalette {
  id: string;
  name: string;
  topColor: string;
  bottomColor: string;
  // Lumière du verre, blanche sur une palette presque sans couleur
  lumiere: string;
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  default: {
    id: 'default',
    name: 'Défaut (Sombre)',
    topColor: '#121219',
    bottomColor: '#0a0a0d',
    lumiere: '#FFFFFF',
  },
  argenté: {
    id: 'argenté',
    name: 'argenté',
    topColor: '#8A8A8A',
    bottomColor: '#495656',
    lumiere: '#FFFFFF',
  },
  gris: {
    id: 'gris',
    name: 'gris',
    topColor: '#667B97',
    bottomColor: '#636C71',
    lumiere: '#FFFFFF',
  },
  noir: {
    id: 'noir',
    name: 'noir',
    topColor: '#000000',
    bottomColor: '#353535',
    lumiere: '#FFFFFF',
  },
  doré: {
    id: 'doré',
    name: 'doré',
    topColor: '#251E12',
    bottomColor: '#847144',
    lumiere: '#FFC766',
  },
  jaune: {
    id: 'jaune',
    name: 'jaune',
    topColor: '#F7C551',
    bottomColor: '#754E00',
    lumiere: '#FFFF1A',
  },
  orange: {
    id: 'orange',
    name: 'orange',
    topColor: '#F79451',
    bottomColor: '#752700',
    lumiere: '#FF8A2A',
  },
  rouge: {
    id: 'rouge',
    name: 'rouge',
    topColor: '#BB4848',
    bottomColor: '#3D0000',
    lumiere: '#FF1818',
  },
  ecarlate: {
    id: 'ecarlate',
    name: 'ecarlate',
    topColor: '#24000A',
    bottomColor: '#780022',
    lumiere: '#FF066E',
  },
  vert_clair: {
    id: 'vert_clair',
    name: 'vert clair',
    topColor: '#27524C',
    bottomColor: '#58B460',
    lumiere: '#41FFFF',
  },
  forêt: {
    id: 'forêt',
    name: 'forêt',
    topColor: '#001315',
    bottomColor: '#244925',
    lumiere: '#12FFFF',
  },
  marée: {
    id: 'marée',
    name: 'marée',
    topColor: '#001315',
    bottomColor: '#244049',
    lumiere: '#12FFFF',
  },
  feuille: {
    id: 'feuille',
    name: 'feuille',
    topColor: '#798B43',
    bottomColor: '#174100',
    lumiere: '#FFFF17',
  },
  aqua: {
    id: 'aqua',
    name: 'aqua',
    topColor: '#17A0AE',
    bottomColor: '#002A38',
    lumiere: '#0CFFFF',
  },
  ocean: {
    id: 'ocean',
    name: 'ocean',
    topColor: '#1758AE',
    bottomColor: '#000638',
    lumiere: '#0CFFFF',
  },
  hopa: {
    id: 'hopa',
    name: 'hopa',
    topColor: '#000000',
    bottomColor: '#6E8FFE',
    lumiere: '#2FBCFF',
  },
  gris_ciel: {
    id: 'gris_ciel',
    name: 'gris ciel',
    topColor: '#485176',
    bottomColor: '#8592C4',
    lumiere: '#FFFFFF',
  },
  spectre: {
    id: 'spectre',
    name: 'spectre',
    topColor: '#241E47',
    bottomColor: '#5948AD',
    lumiere: '#612AFF',
  },
  mauve: {
    id: 'mauve',
    name: 'mauve',
    topColor: '#12002B',
    bottomColor: '#40005B',
    lumiere: '#FF06FF',
  },
  rose: {
    id: 'rose',
    name: 'rose',
    topColor: '#832B77',
    bottomColor: '#9367A6',
    lumiere: '#FF52FF',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'cyberpunk',
    topColor: '#5117AE',
    bottomColor: '#000638',
    lumiere: '#760DFF',
  },
  melon: {
    id: 'melon',
    name: 'melon',
    topColor: '#7A2D65',
    bottomColor: '#AB3F41',
    lumiere: '#FF26FF',
  },
  goyavier: {
    id: 'goyavier',
    name: 'goyavier',
    topColor: '#783434',
    bottomColor: '#451919',
    lumiere: '#FF2020',
  },
  marron: {
    id: 'marron',
    name: 'marron',
    topColor: '#241F16',
    bottomColor: '#311E00',
    lumiere: '#FFFF0B',
  },
  vin: {
    id: 'vin',
    name: 'vin',
    topColor: '#110105',
    bottomColor: '#20000A',
    lumiere: '#FF064D',
  }
};

