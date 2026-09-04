import { homedir } from 'os';
import { join } from 'path';

/** 지금은 macOS 크롬만 다룬다. 쿠키 복호화 방식이 Windows(App-Bound Encryption)와 완전히 다르다. */
export const isSupportedPlatform = () => process.platform === 'darwin';

export const chromeUserDataDir = () => join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

export const localStatePath = () => join(chromeUserDataDir(), 'Local State');

export const profileDir = (profileFolder: string) => join(chromeUserDataDir(), profileFolder);

export const cookiesPath = (profileFolder: string) => join(profileDir(profileFolder), 'Cookies');

export const historyPath = (profileFolder: string) => join(profileDir(profileFolder), 'History');

export const bookmarksPath = (profileFolder: string) => join(profileDir(profileFolder), 'Bookmarks');
