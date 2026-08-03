'use client';

import { useEffect, useRef } from 'react';

/**
 * Guards unsaved editor work.
 *
 * The content editors had no protection at all: a stray click on the sidebar,
 * a browser back, or a closed tab discarded everything since the last save.
 * That is fine for a form with three fields and catastrophic for a
 * 100-question import that took an hour to clean up.
 *
 * Two layers, because they catch different things:
 *
 *  - `beforeunload` covers reload, tab close, and navigation away from the app.
 *    The browser shows its own generic dialog; the message cannot be customised
 *    (browsers ignore the string), so the copy lives in the in-app dialog below.
 *
 *  - A capture-phase click listener on same-tab links catches in-app navigation,
 *    which `beforeunload` never fires for in a client-side router. The link is
 *    swallowed and handed to `onBlockedNavigation`, so the caller can show a
 *    real dialog and continue to the href if the author confirms.
 */
export function useUnsavedChanges(
  isDirty: boolean,
  onBlockedNavigation: (href: string) => void,
) {
  // Kept in refs so the listeners can stay registered once instead of being
  // torn down and rebuilt on every keystroke in the editor.
  const dirtyRef = useRef(isDirty);
  const handlerRef = useRef(onBlockedNavigation);
  dirtyRef.current = isDirty;
  handlerRef.current = onBlockedNavigation;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Legacy browsers require a returnValue to trigger the prompt.
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      // Let the browser handle new-tab / download / modified clicks normally —
      // none of them destroy the current page's state.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      // Only guard navigation that stays inside this app; an external link
      // opens elsewhere and beforeunload already covers it.
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      handlerRef.current(url.pathname + url.search);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, []);
}
