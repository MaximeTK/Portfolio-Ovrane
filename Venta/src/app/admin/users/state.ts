import type { Dispatch, SetStateAction } from 'react';
import type { UserDetails, UserProfile } from './types';

export type UsersState = {
  users: UserProfile[];
  selected: UserDetails | null;
  loading: boolean;
  error: string | null;
};

export type UsersStateSetter = Dispatch<SetStateAction<UsersState>>;

export const INITIAL_STATE: UsersState = {
  users: [],
  selected: null,
  loading: true,
  error: null,
};

export function setLoading(
  setState: UsersStateSetter,
  value: boolean,
) {
  setState((prev) => ({ ...prev, loading: value }));
}

export function setUsers(
  setState: UsersStateSetter,
  users: UserProfile[],
) {
  setState((prev) => ({ ...prev, users, error: null }));
}

export function setSelected(
  setState: UsersStateSetter,
  user: UserDetails,
) {
  setState((prev) => ({ ...prev, selected: user }));
}

export function setError(
  setState: UsersStateSetter,
  error: unknown,
) {
  const message =
    error instanceof Error ? error.message : 'Erreur inconnue';
  setState((prev) => ({ ...prev, error: message }));
}

