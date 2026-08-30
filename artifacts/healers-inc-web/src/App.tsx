import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@workspace/healers-inc/components/ui/toaster';
import { TooltipProvider } from '@workspace/healers-inc/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Practitioners from '@/pages/practitioners';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Nav />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/practitioners" component={Practitioners} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
