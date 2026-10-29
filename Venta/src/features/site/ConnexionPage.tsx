'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ETIQUETTE, Verre } from './ProjectPage';
import type { useChatController } from '@/features/chat/useChatController';
import { INDISPONIBLE } from '@/lib/messages';

type Mode = 'login' | 'register' | 'oubli' | 'reinit';
type Compte = { pseudo: string; email: string };

const VIDES = { identifier: '', pseudo: '', email: '', password: '', inviteCode: '' };
const TITRES: Record<Mode, string> = { login: 'Connexion', register: 'Créer un compte', oubli: 'Mot de passe oublié', reinit: 'Nouveau mot de passe' };
const BOUTONS: Record<Mode, string> = { login: 'Se connecter', register: 'Créer le compte', oubli: 'Envoyer le lien', reinit: 'Changer le mot de passe' };
const LIEN = 'text-sm text-white/70 underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white';

// POST JSON vers le relai ; l'erreur du backend devient celle de l'action
async function poster(chemin: string, corps: object = {}) {
  const res = await fetch(chemin, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(data?.error || INDISPONIBLE);
}

function Champ({ label, aide, ...input }: { label: string; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={ETIQUETTE}>{label}</label>
      <input
        id={id}
        required
        aria-describedby={aide ? `${id}-aide` : undefined}
        className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-sm text-white transition hover:border-white/30"
        {...input}
      />
      {aide && <p id={`${id}-aide`} className="mt-1.5 text-xs text-white/60">{aide}</p>}
    </div>
  );
}

interface ConnexionPageProps {
  sendAuth: ReturnType<typeof useChatController>['sendAuth'];
  // Change à chaque connexion, inscription ou déconnexion : le compte affiché est alors relu
  utilisateur: string | null;
  // Jeton du lien « mot de passe oublié », oublié une fois utilisé ou abandonné
  reinit: string | null;
  finirReinit: () => void;
}

// Le compte Ovrane, porte d'entrée d'Illusion : connexion, inscription sur invitation, mot de passe oublié, puis le compte connecté
export function ConnexionPage({ sendAuth, utilisateur, reinit, finirReinit }: ConnexionPageProps) {
  // undefined tant que le compte de la session n'est pas connu
  const [compte, setCompte] = useState<Compte | null>();
  const [mode, setMode] = useState<Mode>(reinit ? 'reinit' : 'login');
  const [champs, setChamps] = useState(VIDES);
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let actif = true;
    fetch('/api/auth/compte')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => actif && setCompte(data?.compte ?? null))
      .catch(() => actif && setCompte(null));
    return () => {
      actif = false;
    };
  }, [utilisateur]);

  const changer = (cle: keyof typeof VIDES) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setChamps((c) => ({ ...c, [cle]: e.target.value }));
    setErreur('');
  };

  const basculer = (m: Mode) => {
    if (mode === 'reinit') finirReinit();
    setMode(m);
    setErreur('');
    setInfo('');
  };

  // Une action à la fois ; l'erreur du backend s'affiche telle quelle
  const agir = async (action: () => Promise<void>) => {
    if (envoi) return;
    setEnvoi(true);
    setErreur('');
    setInfo('');
    try {
      await action();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : INDISPONIBLE);
    } finally {
      setEnvoi(false);
    }
  };

  const envoyer = (e: React.FormEvent) => {
    e.preventDefault();
    const { identifier, pseudo, email, password, inviteCode } = champs;
    agir(async () => {
      if (mode === 'oubli') {
        await poster('/api/auth/oubli', { email });
        setInfo('Si un compte existe pour cette adresse, un lien vient de partir. Il reste valable 30 minutes.');
      } else if (mode === 'reinit') {
        await poster('/api/auth/reinitialiser', { jeton: reinit, password });
        finirReinit();
        // Les sessions du compte sont fermées : le chat repart sur un profil valable
        await sendAuth('visitor', {});
        setMode('login');
        setInfo('Mot de passe changé. Connectez-vous avec le nouveau.');
      } else {
        await sendAuth(mode, mode === 'login' ? { identifier, password } : { pseudo, email, password, inviteCode });
      }
      setChamps(VIDES);
    });
  };

  // La session est révoquée, puis un nouveau profil visiteur reprend le chat
  const deconnecter = () =>
    agir(async () => {
      await poster('/api/auth/logout');
      await sendAuth('visitor', {});
    });

  const formulaire = mode === 'reinit' || compte === null;
  const titre = formulaire ? TITRES[mode] : compte ? `Bonjour ${compte.pseudo}` : 'Compte';
  const alerte = erreur && <p role="alert" className="text-sm text-red-300">{erreur}</p>;
  const motDePasse = mode !== 'oubli' && (
    <>
      <Champ
        label={mode === 'reinit' ? 'Nouveau mot de passe' : 'Mot de passe'}
        type={visible ? 'text' : 'password'}
        value={champs.password}
        onChange={changer('password')}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        {...(mode === 'login' ? {} : { minLength: 8, maxLength: 128, aide: '8 caractères au moins.' })}
      />
      <label className="flex items-center gap-2.5 py-1 text-sm text-white/70">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-white" />
        Afficher le mot de passe
      </label>
    </>
  );

  return (
    <article aria-labelledby="compte-titre" className="mx-auto max-w-md px-4 pb-24 pt-28 font-sans text-white">
      <p className={ETIQUETTE}>Compte Ovrane</p>
      <h1 id="compte-titre" className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{titre}</h1>
      <p className="mt-3 leading-relaxed text-white/70">
        {mode === 'oubli'
          ? 'Indiquez l’adresse de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.'
          : mode === 'reinit'
            ? 'Choisissez le mot de passe de votre compte Ovrane, valable aussi pour Illusion.'
            : <>Votre compte Ovrane vous donne accès à Illusion.{!compte && <> L&apos;inscription se fait sur invitation.</>}</>}
      </p>

      {compte && !formulaire && (
        <Verre as="section" aria-label="Votre compte" className="mt-8 space-y-6 p-6">
          <dl className="space-y-4">
            <div>
              <dt className={ETIQUETTE}>Pseudo</dt>
              <dd className="mt-1">{compte.pseudo}</dd>
            </div>
            <div>
              <dt className={ETIQUETTE}>E-mail</dt>
              <dd className="mt-1 break-all">{compte.email}</dd>
            </div>
          </dl>
          <Link href="/illusion" prefetch={false} className="block w-full rounded-xl bg-white py-3 text-center text-sm font-semibold text-black transition hover:bg-white/85">
            Ouvrir Illusion
          </Link>
          {alerte}
          <button
            type="button"
            onClick={deconnecter}
            disabled={envoi}
            className="w-full rounded-xl border border-white/25 py-3 text-sm font-semibold text-white transition hover:border-white/60 disabled:opacity-50"
          >
            {envoi ? '…' : 'Se déconnecter'}
          </button>
        </Verre>
      )}

      {formulaire && (
        <Verre as="section" className="mt-8 p-6">
          {(mode === 'login' || mode === 'register') && (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => basculer(m)}
                  className={`rounded-lg py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    mode === m ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={envoyer} className="space-y-5">
            {mode === 'login' && (
              <Champ label="Pseudo ou e-mail" value={champs.identifier} onChange={changer('identifier')} autoComplete="username" />
            )}
            {mode === 'register' && (
              <Champ
                label="Pseudo"
                value={champs.pseudo}
                onChange={changer('pseudo')}
                autoComplete="username"
                maxLength={25}
                aide="Lettres, chiffres, espaces et tirets ; 25 caractères au plus."
              />
            )}
            {(mode === 'register' || mode === 'oubli') && (
              <Champ label="E-mail" type="email" value={champs.email} onChange={changer('email')} autoComplete="email" />
            )}
            {motDePasse}
            {mode === 'register' && (
              <Champ label="Code d'invitation" value={champs.inviteCode} onChange={changer('inviteCode')} autoComplete="off" />
            )}
            {alerte}
            {info && <p role="status" className="text-sm text-emerald-300">{info}</p>}
            <button
              type="submit"
              disabled={envoi}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0a0a0e] transition hover:bg-white/85 disabled:opacity-50"
            >
              {envoi ? '…' : BOUTONS[mode]}
            </button>
          </form>

          <div className="mt-5 text-center">
            {mode === 'login' && <button type="button" onClick={() => basculer('oubli')} className={LIEN}>Mot de passe oublié ?</button>}
            {mode === 'oubli' && <button type="button" onClick={() => basculer('login')} className={LIEN}>Retour à la connexion</button>}
            {mode === 'reinit' && <button type="button" onClick={() => basculer('oubli')} className={LIEN}>Demander un nouveau lien</button>}
          </div>
        </Verre>
      )}
    </article>
  );
}
