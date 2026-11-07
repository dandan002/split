import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';

import type { ReceiptDraft } from './core/receipt.mjs';

export type TabName = 'groups' | 'activity' | 'scan' | 'profile';

// Every screen and its params. Screens outside the tab roots are pushed on a
// stack above the active tab.
export type Route =
  | { name: 'groups' }
  | { name: 'activity' }
  | { name: 'scan'; groupId?: string }
  | { name: 'profile' }
  | { name: 'createGroup' }
  | { name: 'group'; groupId: string }
  | { name: 'members'; groupId: string }
  | { name: 'review'; groupId: string; draft: ReceiptDraft }
  | { name: 'expense'; expenseId: string }
  | { name: 'settle'; groupId: string; fromId?: string; toId?: string; amountCents?: number }
  | { name: 'settlement'; settlementId: string };

type Navigation = {
  route: Route;
  canGoBack: boolean;
  tab: TabName;
  push: (route: Route) => void;
  replace: (route: Route) => void;
  back: () => void;
  switchTab: (tab: TabName, route?: Route) => void;
};

const NavigationContext = createContext<Navigation | null>(null);

const TAB_ROUTES: Record<TabName, Route> = {
  groups: { name: 'groups' },
  activity: { name: 'activity' },
  scan: { name: 'scan' },
  profile: { name: 'profile' },
};

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabName>('groups');
  const [stack, setStack] = useState<Route[]>([TAB_ROUTES.groups]);

  const push = useCallback((route: Route) => setStack((current) => [...current, route]), []);
  const replace = useCallback(
    (route: Route) => setStack((current) => [...current.slice(0, -1), route]),
    [],
  );
  const back = useCallback(() => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)), []);
  const switchTab = useCallback((next: TabName, route?: Route) => {
    setTab(next);
    setStack([route ?? TAB_ROUTES[next]]);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, back]);

  const value = useMemo<Navigation>(
    () => ({
      route: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      tab,
      push,
      replace,
      back,
      switchTab,
    }),
    [stack, tab, push, replace, back, switchTab],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) {
    throw new Error('useNavigation must be used inside NavigationProvider');
  }
  return value;
}
