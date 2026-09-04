export const bearer = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : undefined);
