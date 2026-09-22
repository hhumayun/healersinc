import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@workspace/healers-inc/components/ui/toaster';
import { TooltipProvider } from '@workspace/healers-inc/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Practitioners from '@/pages/practitioners';
import { LoadingBlock, Page } from '@/components/page';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { RequireClient, RequireMember, RequirePractitioner } from '@/components/require-client';
import { SessionProvider } from '@/lib/session';
import { useRealtime } from '@/hooks/use-realtime';
import '@/lib/api';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!clerkPublishableKey) {
  throw new Error(
    'VITE_CLERK_PUBLISHABLE_KEY is required. Copy it from the Clerk dashboard (same instance as the mobile app).',
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Everything past the marketing pages loads on demand so first paint of the
// home page does not pay for the booking, messaging and Clerk UI code.
const SignIn = lazy(() => import('@/pages/sign-in'));
const SignUp = lazy(() => import('@/pages/sign-up'));
const Discover = lazy(() => import('@/pages/discover'));
const PractitionerDetail = lazy(() => import('@/pages/practitioner'));
const Book = lazy(() => import('@/pages/book'));
const Bookings = lazy(() => import('@/pages/bookings'));
const Appointment = lazy(() => import('@/pages/appointment'));
const CheckoutReturn = lazy(() => import('@/pages/checkout-return'));
const Messages = lazy(() => import('@/pages/messages'));
const Conversation = lazy(() => import('@/pages/conversation'));
const Notifications = lazy(() => import('@/pages/notifications'));
const Review = lazy(() => import('@/pages/review'));
const Account = lazy(() => import('@/pages/account'));
const PractitionerSignup = lazy(() => import('@/pages/practitioner-signup'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Schedule = lazy(() => import('@/pages/schedule'));
const ManageProfile = lazy(() => import('@/pages/manage/profile'));
const ManageServices = lazy(() => import('@/pages/manage/services'));
const ManageAvailability = lazy(() => import('@/pages/manage/availability'));
const ManagePolicy = lazy(() => import('@/pages/manage/policy'));
const ManagePayments = lazy(() => import('@/pages/manage/payments'));

type RouteDef = { path: string; component: ComponentType };

/** Routes only clients can use. */
const CLIENT_ROUTES: RouteDef[] = [
  { path: '/book/:practitionerId', component: Book },
  { path: '/bookings', component: Bookings },
  { path: '/review/:appointmentId', component: Review },
];

/** Routes shared by both portals; the page adapts to the active role. */
const MEMBER_ROUTES: RouteDef[] = [
  { path: '/appointment/:id', component: Appointment },
  { path: '/messages', component: Messages },
  { path: '/messages/:conversationId', component: Conversation },
  { path: '/notifications', component: Notifications },
  { path: '/account', component: Account },
];

/** Routes only practitioners with a finished application can use. */
const PRACTITIONER_ROUTES: RouteDef[] = [
  { path: '/dashboard', component: Dashboard },
  { path: '/schedule', component: Schedule },
  { path: '/manage/profile', component: ManageProfile },
  { path: '/manage/services', component: ManageServices },
  { path: '/manage/availability', component: ManageAvailability },
  { path: '/manage/policy', component: ManagePolicy },
  { path: '/manage/payments', component: ManagePayments },
];

function Router() {
  useRealtime();

  return (
    <RoutedErrorBoundary>
      <Nav />
      <Suspense
        fallback={
          <Page>
            <LoadingBlock />
          </Page>
        }
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/practitioners" component={Practitioners} />
          <Route path="/sign-in" component={SignIn} />
          <Route path="/sign-up" component={SignUp} />
          {/* Discovery is public: browsing needs no account, booking does. */}
          <Route path="/discover" component={Discover} />
          <Route path="/practitioner/:id" component={PractitionerDetail} />
          {/* Stripe lands here in a popup; it only relays the result to the opener. */}
          <Route path="/checkout-return" component={CheckoutReturn} />
          {/* The application handles anonymous, mid-application and finished accounts itself. */}
          <Route path="/practitioner-signup" component={PractitionerSignup} />
          {CLIENT_ROUTES.map(({ path, component: Component }) => (
            <Route key={path} path={path}>
              <RequireClient>
                <Component />
              </RequireClient>
            </Route>
          ))}
          {MEMBER_ROUTES.map(({ path, component: Component }) => (
            <Route key={path} path={path}>
              <RequireMember>
                <Component />
              </RequireMember>
            </Route>
          ))}
          {PRACTITIONER_ROUTES.map(({ path, component: Component }) => (
            <Route key={path} path={path}>
              <RequirePractitioner>
                <Component />
              </RequirePractitioner>
            </Route>
          ))}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
    <ClerkProvider publishableKey={clerkPublishableKey!} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
