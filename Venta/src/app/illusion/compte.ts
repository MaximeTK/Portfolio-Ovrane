import { cache } from 'react';
import { compteDepuisCookies } from '@/features/illusion/serveur';

// Le compte de la session, lu une fois par requête pour la mise en page et la page
export const compteDeLaSession = cache(compteDepuisCookies);
