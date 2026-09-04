export const hasNaverSession = (cookieNames: string[]) =>
  cookieNames.includes('NID_AUT') && cookieNames.includes('NID_SES');
