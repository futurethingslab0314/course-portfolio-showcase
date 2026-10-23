import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageValue, readPageValue, updatePageValue } from './pageLinkState';

const PageLinkContext = createContext<{
  params: URLSearchParams;
  update: (key: string, value: PageValue | ((previous: PageValue) => PageValue), fallback: PageValue) => void;
} | null>(null);

export function PageLinkProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useSearchParams();
  const current = useRef(params);
  current.current = params;
  const navigate = useRef(setParams);
  navigate.current = setParams;
  const pending = useRef(false);
  const update = useCallback((key: string, value: PageValue | ((previous: PageValue) => PageValue), fallback: PageValue) => {
    const previous = readPageValue(current.current, key, fallback);
    const resolved = typeof value === 'function' ? value(previous) : value;
    if (resolved === previous) return;
    const next = updatePageValue(current.current, key, resolved, fallback);
    current.current = next;
    // Combine changes from the same click into one history entry.
    if (!pending.current) {
      pending.current = true;
      queueMicrotask(() => {
        pending.current = false;
        navigate.current(current.current);
      });
    }
  }, []);
  return <PageLinkContext.Provider value={{ params, update }}>{children}</PageLinkContext.Provider>;
}

// Components rendered independently (previews, print documents) retain local state.
export function usePageLinkState<T extends PageValue>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const context = useContext(PageLinkContext);
  const [local, setLocal] = useState(fallback);
  const update = context?.update;
  const setValue = useCallback((value: React.SetStateAction<T>) => {
    if (update) update(key, value as PageValue | ((previous: PageValue) => PageValue), fallback);
    else setLocal(value);
  }, [update, key, fallback]);
  return [context ? readPageValue(context.params, key, fallback) : local, setValue];
}
