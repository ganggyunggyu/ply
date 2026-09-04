import type { BridgeApi, StoredBookmarkView, StoredVisitView } from '../bridge';
import { SIDEBAR } from '../messages';

type LibraryTab = 'bookmarks' | 'history';

type LibraryEls = {
  tabBookmarks: HTMLButtonElement;
  tabHistory: HTMLButtonElement;
  search: HTMLInputElement;
  list: HTMLUListElement;
};

/** 북마크/방문기록을 하나로 본 목록 항목. history 는 title 이 비는 일이 있어 url 로 대체한다. */
type Entry = { name: string; url: string };

const bookmarkEntry = ({ name, url }: StoredBookmarkView): Entry => ({ name: name || url, url });
const visitEntry = ({ title, url }: StoredVisitView): Entry => ({ name: title || url, url });

const matches = (entry: Entry, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return entry.name.toLowerCase().includes(q) || entry.url.toLowerCase().includes(q);
};

/** 검색 결과가 아무리 많아도 렌더는 이 수까지만. 5000건을 다 그리면 사이드바가 버벅인다. */
const RENDER_LIMIT = 300;

export const createLibrary = (api: BridgeApi, els: LibraryEls) => {
  let active: LibraryTab = 'bookmarks';
  let bookmarks: Entry[] = [];
  let history: Entry[] = [];

  const source = () => (active === 'bookmarks' ? bookmarks : history);

  const buildRow = ({ name, url }: Entry) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'lib-row';
    button.title = url;
    button.textContent = name;
    button.addEventListener('click', () => void api.createTab({ url }));
    item.append(button);
    return item;
  };

  const renderList = () => {
    const shown = source().filter((entry) => matches(entry, els.search.value)).slice(0, RENDER_LIMIT);

    if (shown.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'lib-empty';
      empty.textContent = SIDEBAR.libEmpty;
      els.list.replaceChildren(empty);
      return;
    }

    els.list.replaceChildren(...shown.map(buildRow));
  };

  const setActive = (tab: LibraryTab) => {
    active = tab;
    els.tabBookmarks.dataset.active = String(tab === 'bookmarks');
    els.tabHistory.dataset.active = String(tab === 'history');
    renderList();
  };

  const load = async () => {
    const [bm, hist] = await Promise.all([api.listBookmarks(), api.listVisitHistory()]);
    bookmarks = bm.map(bookmarkEntry);
    history = hist.map(visitEntry);
    renderList();
  };

  els.tabBookmarks.addEventListener('click', () => setActive('bookmarks'));
  els.tabHistory.addEventListener('click', () => setActive('history'));
  els.search.addEventListener('input', renderList);

  return { load };
};
