export type FinanceAuthStatus = 'loading' | 'guest' | 'authenticated';

export function useFinanceAuth() {
  const username = useState<string | null>('finance-auth-user', () => null);
  const status = useState<FinanceAuthStatus>('finance-auth-status', () => 'loading');

  async function refresh() {
    status.value = 'loading';
    try {
      const data = await $fetch<{ username: string }>('/api/auth/finance/me');
      username.value = data.username;
      status.value = 'authenticated';
    } catch {
      username.value = null;
      status.value = 'guest';
    }
  }

  async function login(user: string, pass: string) {
    await $fetch('/api/auth/finance/login', {
      method: 'POST',
      body: { username: user, password: pass },
    });
    await refresh();
  }

  async function logout() {
    try {
      await $fetch('/api/auth/finance/logout', { method: 'POST' });
    } finally {
      username.value = null;
      status.value = 'guest';
    }
  }

  return {
    username: readonly(username),
    status: readonly(status),
    refresh,
    login,
    logout,
  };
}
