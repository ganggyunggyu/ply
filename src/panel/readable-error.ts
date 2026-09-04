
/** Electron IPC 가 붙이는 "Error invoking remote method 'x': Error: " 접두사를 걷어낸다. */
export const readableError = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);

  return raw
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^(Error|AxiosError):\s*/, '')
    .trim();
};
