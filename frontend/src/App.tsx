import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { NatsProvider } from './contexts/NatsContext';
import { MainLayout } from './components/layout/MainLayout';
import { hasToken } from './services/api-client';

// Pages
import Dashboard from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Streams } from './pages/Streams';
import { Consumers } from './pages/Consumers';
import { KVStore } from './pages/KVStore';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const Router = import.meta.env.VITE_ROUTER_TYPE === 'hash' ? HashRouter : BrowserRouter;
const basename = Router === HashRouter ? undefined : import.meta.env.BASE_URL;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <NatsProvider>
          <Router basename={basename}>
            <div className="min-h-screen bg-background text-foreground">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="streams" element={<Streams />} />
                  <Route path="consumers" element={<Consumers />} />
                  <Route path="kv-store" element={<KVStore />} />
                  <Route path="monitoring" element={<Monitoring />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </div>
          </Router>
          <Toaster
            position="top-right"
            expand={true}
            richColors
            closeButton
          />
        </NatsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
