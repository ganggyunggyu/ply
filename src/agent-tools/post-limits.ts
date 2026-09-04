export const MAX_DELETE_PER_CALL = 10;
export const MAX_DELETE_PER_RUN = 10;
export const MAX_LIST_POSTS = 30;
const DEFAULT_LIST_POSTS = 10;

export type KnownPost = {
  logNo: string;
  title: string;
  addDate: string;
  blogId: string;
  accountId: string;
};

export const clampListLimit = (raw: unknown): number => {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIST_POSTS;

  return Math.min(value, MAX_LIST_POSTS);
};
