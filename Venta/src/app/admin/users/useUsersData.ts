import { useEffect, useMemo, useState } from 'react';
import type { UserDetails, UserProfile } from './types';
import {
  INITIAL_STATE,
  setError,
  setLoading,
  setSelected,
  setUsers,
  type UsersState,
  type UsersStateSetter,
} from './state';

type UsersResponse = { users: UserProfile[] };
type UserResponse = { user: UserDetails };

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:3001';
const ERROR_LOAD = 'Erreur de chargement';

export function useUsersData() {
  const [state, setState] = useState(INITIAL_STATE);
  const fetchUsers = useMemo(() => createFetchUsers(setState), [setState]);
  const fetchUserDetails = useMemo(
    () => createFetchUserDetails(setState),
    [setState],
  );
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  return buildApi(state, fetchUsers, fetchUserDetails);
}

async function requestJson<T>(path: string) {
  const response = await fetch(`${BACKEND_URL}${path}`);
  if (!response.ok) throw new Error(ERROR_LOAD);
  return response.json() as Promise<T>;
}

function createFetchUsers(setState: UsersStateSetter) {
  return async () => {
    setLoading(setState, true);
    try {
      const data = await requestJson<UsersResponse>('/api/admin/users');
      setUsers(setState, data.users);
    } catch (error) {
      setError(setState, error);
    } finally {
      setLoading(setState, false);
    }
  };
}

function createFetchUserDetails(setState: UsersStateSetter) {
  return async (userId: string) => {
    try {
      const data = await requestJson<UserResponse>(
        `/api/admin/users/${userId}`,
      );
      setSelected(setState, data.user);
    } catch (error) {
      setError(setState, error);
    }
  };
}

function buildApi(
  state: UsersState,
  fetchUsers: () => Promise<void>,
  fetchUserDetails: (userId: string) => Promise<void>,
) {
  return {
    users: state.users,
    selectedUser: state.selected,
    loading: state.loading,
    error: state.error,
    fetchUsers,
    fetchUserDetails,
  };
}

