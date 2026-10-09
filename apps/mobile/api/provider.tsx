import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { type ApiClient } from './client';
import { PlacesSession } from './session';

interface ApiContextValue {
  client: ApiClient;
  session: PlacesSession;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  });
}

/** Provides the API client, the Places session and TanStack Query to the app. */
export function ApiProvider({
  client,
  queryClient,
  session,
  children,
}: {
  client: ApiClient;
  queryClient?: QueryClient;
  session?: PlacesSession;
  children: ReactNode;
}) {
  const [value] = useState<ApiContextValue>(() => ({
    client,
    session: session ?? new PlacesSession(),
  }));
  const [queries] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={queries}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );
}

export function useApi(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) throw new Error('useApi must be used inside <ApiProvider>');
  return value;
}
