import { redirect } from 'next/navigation';
import { ErreurIllusion, type Compte } from '@/features/illusion/api';
import { RacineIllusion } from '@/features/illusion/ossature/RacineIllusion';
import { INDISPONIBLE } from '@/lib/messages';
import { compteDeLaSession } from './compte';

// Sans session, la vue Compte du portfolio ; elle ne sait pas ramener ici, l'utilisateur rouvre Illusion après la connexion
export default async function LayoutIllusion({ children }: { children: React.ReactNode }) {
  let compte: Compte | null;
  try {
    compte = await compteDeLaSession();
  } catch (erreur) {
    // Ovrane ou Illusion injoignable : un message clair plutôt que la page d'erreur de Next
    return (
      <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, color: '#fff', textAlign: 'center' }}>
        {erreur instanceof ErreurIllusion && erreur.message ? erreur.message : INDISPONIBLE}
      </main>
    );
  }
  if (!compte) redirect('/connexion');
  return <RacineIllusion compte={compte}>{children}</RacineIllusion>;
}
