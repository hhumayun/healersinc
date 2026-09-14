import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@workspace/healers-inc/components/ui/toaster';
import { TooltipProvider } from '@workspace/healers-inc/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Practitioners from '@/pages/practitioners';
import SignIn from '@/pages/sign-in';
import SignUp from '@/pages/sign-up';
import Discover from '@/pages/discover';
import PractitionerProfilePage from '@/pages/practitioner';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { useRealtime } from '@/hooks/use-realtime';
import { SessionProvider } from '@/lib/session';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  // One socket for the whole site; every event invalidates the queries it
  // affects, so chat, bookings and notifications stay live.
  useRealtime();

  return (
    <RoutedErrorBoundary>
      <Nav />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/practitioners" component={Practitioners} />
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />
        <Route path="/discover" component={Discover} />
        <Route path="/practitioner/:id" component={PractitionerProfilePage} />
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
          <SessionProvider>
            <Router />
          </SessionProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
