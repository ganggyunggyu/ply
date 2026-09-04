import { SETTINGS } from '../messages';
import {
  api,
  chromeProfileEl,
  chromeTargetEl,
  chromeCookiesEl,
  chromeBookmarksEl,
  chromeHistoryEl,
  runChromeImportEl,
  chromeImportHintEl,
} from './dom';
import { readableError } from './readable-error';

const fillOptions = (select: HTMLSelectElement, items: { value: string; label: string }[]) => {
  select.innerHTML = '';
  items.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
};

/** 설정을 처음 그릴 때 크롬 프로필 목록과 Ply 프로필 목록을 채운다. 미지원 OS 면 카드를 통째로 끈다. */
export const initChromeImport = async () => {
  try {
    const { supported, profiles } = await api.listChromeProfiles();

    if (!supported) {
      chromeImportHintEl.textContent = SETTINGS.chromeImportUnsupported;
      runChromeImportEl.disabled = true;
      return;
    }

    if (profiles.length === 0) {
      chromeImportHintEl.textContent = SETTINGS.chromeImportNoProfiles;
      runChromeImportEl.disabled = true;
      return;
    }

    fillOptions(
      chromeProfileEl,
      profiles.map(({ folder, label }) => ({ value: folder, label: `${label} (${folder})` })),
    );

    const plyProfiles = await api.listProfiles();
    fillOptions(
      chromeTargetEl,
      plyProfiles.map(({ id, label }) => ({ value: id, label })),
    );

    chromeImportHintEl.textContent = SETTINGS.chromeImportKeychainNotice;
  } catch (error) {
    chromeImportHintEl.textContent = readableError(error);
  }
};

export const handleRunChromeImport = async () => {
  runChromeImportEl.disabled = true;
  chromeImportHintEl.textContent = SETTINGS.chromeImportRunning;

  try {
    const result = await api.importFromChrome({
      profileFolder: chromeProfileEl.value,
      targetProfileId: chromeTargetEl.value,
      cookies: chromeCookiesEl.checked,
      bookmarks: chromeBookmarksEl.checked,
      history: chromeHistoryEl.checked,
    });

    const done = SETTINGS.chromeImportDone(result.cookiesSet, result.bookmarksAdded, result.historyAdded);
    chromeImportHintEl.textContent = result.errors.length > 0 ? `${done} · ${result.errors.join(' / ')}` : done;
  } catch (error) {
    chromeImportHintEl.textContent = readableError(error);
  } finally {
    runChromeImportEl.disabled = false;
  }
};
