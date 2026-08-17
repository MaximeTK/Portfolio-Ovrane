'use client';

import React, { useState, useRef, useEffect } from 'react';

type AuthMode = 'login' | 'register';

interface AuthFormProps {
  onSubmit: (mode: AuthMode, data: Record<string, string>) => Promise<void>;
}

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, type, value, onChange, autoComplete }, ref) => (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[9px] font-bold tracking-[0.2em] text-white/30 uppercase">
        {label}
      </label>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="bg-transparent border-b border-white/20 focus:border-white/50 text-white text-sm py-1 outline-none transition-colors placeholder:text-white/20 w-full"
      />
    </div>
  ),
);
Field.displayName = 'Field';

export const AuthForm = ({ onSubmit }: AuthFormProps) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fields, setFields] = useState({
    identifier: '',
    pseudo: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [mode]);

  const handleChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const data: Record<string, string> =
      mode === 'login'
        ? { identifier: fields.identifier, password: fields.password }
        : {
            pseudo: fields.pseudo,
            email: fields.email,
            password: fields.password,
            inviteCode: fields.inviteCode,
          };

    setLoading(true);
    setError(null);

    try {
      await onSubmit(mode, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.');
      setLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto px-6 select-none">
      {/* Mode toggle */}
      <div className="flex gap-8 mb-8">
        {(['login', 'register'] as AuthMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`text-[10px] font-bold tracking-[0.25em] uppercase transition-all ${
              mode === m
                ? 'text-white border-b border-white pb-1'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {m === 'login' ? 'Connexion' : 'Inscription'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        {mode === 'register' ? (
          <>
            <Field
              ref={firstInputRef}
              label="Pseudo"
              type="text"
              value={fields.pseudo}
              onChange={handleChange('pseudo')}
              autoComplete="username"
            />
            <Field
              label="Email"
              type="email"
              value={fields.email}
              onChange={handleChange('email')}
              autoComplete="email"
            />
            <Field
              label="Mot de passe"
              type="password"
              value={fields.password}
              onChange={handleChange('password')}
              autoComplete="new-password"
            />
            <Field
              label="Code d'invitation"
              type="text"
              value={fields.inviteCode}
              onChange={handleChange('inviteCode')}
              autoComplete="off"
            />
          </>
        ) : (
          <>
            <Field
              ref={firstInputRef}
              label="Pseudo ou email"
              type="text"
              value={fields.identifier}
              onChange={handleChange('identifier')}
              autoComplete="username"
            />
            <Field
              label="Mot de passe"
              type="password"
              value={fields.password}
              onChange={handleChange('password')}
              autoComplete="current-password"
            />
          </>
        )}

        {error && (
          <p className="text-red-500 text-[10px] tracking-wider text-center mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 text-[10px] font-bold tracking-[0.3em] uppercase text-white/50 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
        >
          {loading ? '...' : 'Confirmer'}
        </button>
      </form>
    </div>
  );
};
