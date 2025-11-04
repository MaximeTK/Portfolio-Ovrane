'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  name: string | null;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  conversationCount: number;
}

interface UserDetails extends UserProfile {
  ipHash: string;
  preferences: Record<string, any>;
  conversations: Array<{
    timestamp: string;
    prompt: string;
    response: string;
    detectedName?: string;
  }>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3001';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/admin/users`);
      if (!response.ok) throw new Error('Erreur de chargement');
      const data = await response.json();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('Erreur de chargement');
      const data = await response.json();
      setSelectedUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">👥 Administration - Profils Utilisateurs</h1>
          <p className="text-gray-400">Système de mémoire de l'IA Venta</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            ❌ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des utilisateurs */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Utilisateurs ({users.length})</h2>
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                🔄 Actualiser
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-400">Chargement...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Aucun utilisateur enregistré
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => fetchUserDetails(user.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedUser?.id === user.id
                        ? 'bg-blue-900/30 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-lg">
                        {user.name ? `🏷️ ${user.name}` : '👤 Anonyme'}
                      </div>
                      <div className="text-sm text-gray-400 font-mono">
                        {user.id.substring(0, 8)}...
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>📊 {user.visitCount} visite{user.visitCount > 1 ? 's' : ''}</div>
                      <div>💬 {user.conversationCount} conversation{user.conversationCount > 1 ? 's' : ''}</div>
                      <div>🕒 Dernière visite: {formatDate(user.lastVisit)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Détails de l'utilisateur sélectionné */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            {selectedUser ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-4">
                    {selectedUser.name ? `🏷️ ${selectedUser.name}` : '👤 Profil Utilisateur'}
                  </h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">ID:</span>
                      <span className="font-mono">{selectedUser.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">IP Hash:</span>
                      <span className="font-mono text-xs">{selectedUser.ipHash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Première visite:</span>
                      <span>{formatDate(selectedUser.firstVisit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Dernière visite:</span>
                      <span>{formatDate(selectedUser.lastVisit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Nombre de visites:</span>
                      <span className="font-semibold">{selectedUser.visitCount}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-3">💬 Historique des conversations</h3>
                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                    {selectedUser.conversations.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        Aucune conversation
                      </div>
                    ) : (
                      selectedUser.conversations.map((conv, index) => (
                        <div
                          key={index}
                          className="bg-gray-800 p-4 rounded-lg border border-gray-700"
                        >
                          <div className="text-xs text-gray-400 mb-2">
                            {formatDate(conv.timestamp)}
                            {conv.detectedName && (
                              <span className="ml-2 text-green-400">🏷️ Nom détecté: {conv.detectedName}</span>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="text-blue-400 font-semibold mb-1">👤 Utilisateur:</div>
                              <div className="text-sm pl-4">{conv.prompt}</div>
                            </div>
                            <div>
                              <div className="text-green-400 font-semibold mb-1">🤖 IA:</div>
                              <div className="text-sm pl-4 text-gray-300">{conv.response}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">👈</div>
                  <p>Sélectionnez un utilisateur pour voir les détails</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">ℹ️ Informations</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Les utilisateurs sont identifiés automatiquement par leur IP + User-Agent</li>
            <li>• Les adresses IP sont hashées pour la confidentialité</li>
            <li>• L'historique est limité aux 100 dernières conversations par utilisateur</li>
            <li>• Les 5 dernières conversations sont chargées dans le contexte de l'IA</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

