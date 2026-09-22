import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  getListConversationsQueryKey,
  getListNotificationsQueryKey,
  useListConversations,
  useListNotifications,
  type CurrentUser,
  type PortalRole,
} from '@workspace/api-client-react';
import { cn } from '@workspace/healers-inc/lib/utils';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/healers-inc/components/ui/dropdown-menu';
import {
  Award,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageCircle,
  Repeat,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import logoUrl from '@workspace/healers-inc/logo.svg';
import { UserAvatar } from '@/components/user-avatar';
import { usePortalSwitch } from '@/hooks/use-portal-switch';
import { useSession } from '@/lib/session';
import { signInHref } from '@/components/require-client';

const MARKETING_PATHS = new Set(['/', '/practitioners']);

type NavLink = { href: string; label: string; icon: LucideIcon; testId: string };

const CLIENT_LINKS: NavLink[] = [
  { href: '/discover', label: 'Discover', icon: Search, testId: 'discover' },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays, testId: 'bookings' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, testId: 'messages' },
];

const PRACTITIONER_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testId: 'dashboard' },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays, testId: 'schedule' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, testId: 'messages' },
];

/** A practitioner whose application is unfinished only has the wizard. */
const APPLICANT_LINKS: NavLink[] = [
  { href: '/practitioner-signup', label: 'Your application', icon: Award, testId: 'application' },
];

/** The practice-management pages, shown in the account menu for practitioners. */
export const PRACTICE_LINKS: NavLink[] = [
  { href: '/manage/profile', label: 'Public profile', icon: UserRound, testId: 'manage-profile' },
  { href: '/manage/services', label: 'Services', icon: LayoutGrid, testId: 'manage-services' },
  { href: '/manage/availability', label: 'Availability', icon: Clock, testId: 'manage-availability' },
  { href: '/manage/policy', label: 'Booking rules', icon: SlidersHorizontal, testId: 'manage-policy' },
  { href: '/manage/payments', label: 'Payments', icon: CreditCard, testId: 'manage-payments' },
];

function primaryLinks(user: CurrentUser): NavLink[] {
  if (user.activeRole === 'practitioner') {
    return user.onboardingComplete ? PRACTITIONER_LINKS : APPLICANT_LINKS;
  }
  return CLIENT_LINKS;
}

function isActive(location: string, href: string): boolean {
  return location === href || location.startsWith(`${href}/`);
}

/** Small count/dot badge for unread indicators. */
function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground',
        className,
      )}
      aria-label={`${count} unread`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Nav() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { status, user, signOut } = useSession();
  const portal = usePortalSwitch();

  const signedIn = status === 'authenticated' && user !== null;
  const onboarded = signedIn && (user.isClient || user.isPractitioner);
  const isMarketing = MARKETING_PATHS.has(location);
  const isPractitionerPage = location === '/practitioners';
  const isPractitioner = onboarded && user.activeRole === 'practitioner';
  const holdsBothRoles = onboarded && user.isClient && user.isPractitioner;

  // Unread indicators are only fetched once signed in; realtime events
  // invalidate these queries so the counts stay current.
  const notifications = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled: onboarded },
  });
  const conversations = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), enabled: onboarded },
  });
  const unreadNotifications = (notifications.data ?? []).filter((n) => !n.readAt).length;
  const unreadMessages = (conversations.data ?? []).reduce((sum, c) => sum + c.unreadCount, 0);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const solid = scrolled || !isMarketing || menuOpen;

  const navLinkClass = (active: boolean, mobile = false) =>
    cn(
      'rounded-md text-sm font-medium transition-colors duration-150 inline-flex items-center gap-2',
      mobile ? 'px-4 py-3' : 'px-4 py-2',
      active
        ? 'text-primary bg-secondary'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
    );

  const marketingLinks = (mobile = false) => (
    <>
      <Link
        href="/"
        data-testid={mobile ? 'nav-mobile-link-clients' : 'nav-link-clients'}
        className={navLinkClass(location === '/', mobile)}
      >
        For Clients
      </Link>
      <Link
        href="/practitioners"
        data-testid={mobile ? 'nav-mobile-link-practitioners' : 'nav-link-practitioners'}
        className={navLinkClass(isPractitionerPage, mobile)}
      >
        For Practitioners
      </Link>
    </>
  );

  const portalLinks = (mobile = false) =>
    (onboarded ? primaryLinks(user) : []).map((link) => {
      const unread = link.href === '/messages' ? unreadMessages : 0;
      return (
        <Link
          key={link.href}
          href={link.href}
          data-testid={mobile ? `nav-mobile-link-${link.testId}` : `nav-link-${link.testId}`}
          className={navLinkClass(isActive(location, link.href), mobile)}
        >
          {mobile ? <link.icon className="w-4 h-4" /> : null}
          {link.label}
          <UnreadBadge count={unread} />
        </Link>
      );
    });

  const otherRole: PortalRole = isPractitioner ? 'client' : 'practitioner';

  return (
    <header
      data-testid="site-nav"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        solid
          ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" data-testid="nav-logo" className="flex items-center gap-3 shrink-0">
          <img src={logoUrl} alt="Healers Inc" className="h-8 w-auto" data-testid="logo-image" />
          <span className="font-semibold text-base text-foreground tracking-tight">
            Healers Inc
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
          {onboarded ? portalLinks() : marketingLinks()}
        </nav>

        {/* Desktop account area */}
        <div className="hidden md:flex items-center gap-2">
          {status === 'loading' ? (
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" aria-hidden />
          ) : onboarded ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                asChild
                data-testid="nav-notifications"
                aria-label="Notifications"
              >
                <Link href="/notifications" className="relative">
                  <Bell className="w-5 h-5" />
                  <UnreadBadge
                    count={unreadNotifications}
                    className="absolute -top-0.5 -right-0.5"
                  />
                </Link>
              </Button>
              <AccountMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild data-testid="nav-sign-in">
                <Link href={signInHref(isMarketing ? undefined : location)}>Sign in</Link>
              </Button>
              {isPractitionerPage ? (
                <Button size="sm" asChild data-testid="nav-cta-practitioner">
                  <Link href="/practitioner-signup">Start your practice</Link>
                </Button>
              ) : (
                <Button size="sm" asChild data-testid="nav-get-started">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Mobile: notifications + menu button */}
        <div className="md:hidden flex items-center gap-1">
          {onboarded ? (
            <Link
              href="/notifications"
              className="relative p-2 rounded-md text-foreground hover:bg-muted transition-colors"
              aria-label="Notifications"
              data-testid="nav-mobile-notifications"
            >
              <Bell className="w-5 h-5" />
              <UnreadBadge count={unreadNotifications} className="absolute top-0.5 right-0.5" />
            </Link>
          ) : null}
          <button
            className="p-2 rounded-md text-foreground hover:bg-muted transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            data-testid="nav-mobile-toggle"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        data-testid="nav-mobile-menu"
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 bg-background border-b border-border',
          menuOpen ? 'max-h-[85dvh] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 py-4 flex flex-col gap-2">
          {onboarded ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3" data-testid="nav-mobile-account">
                <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <RoleBadge role={user.activeRole} />
              </div>
              {portalLinks(true)}
              <Link
                href="/notifications"
                data-testid="nav-mobile-link-notifications"
                className={navLinkClass(isActive(location, '/notifications'), true)}
              >
                <Bell className="w-4 h-4" />
                Notifications
                <UnreadBadge count={unreadNotifications} />
              </Link>
              <Link
                href="/account"
                data-testid="nav-mobile-link-account"
                className={navLinkClass(isActive(location, '/account'), true)}
              >
                <UserRound className="w-4 h-4" />
                Account
              </Link>

              {isPractitioner && user.onboardingComplete ? (
                <div className="pt-2 border-t border-border flex flex-col gap-1">
                  <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your practice
                  </p>
                  {PRACTICE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-testid={`nav-mobile-link-${link.testId}`}
                      className={navLinkClass(isActive(location, link.href), true)}
                    >
                      <link.icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="pt-2 border-t border-border flex flex-col gap-2">
                {holdsBothRoles ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => void portal.switchTo(otherRole)}
                    disabled={portal.isPending}
                    data-testid="nav-mobile-switch-role"
                  >
                    <Repeat className="w-4 h-4" />
                    {portal.isPending
                      ? 'Switching…'
                      : isPractitioner
                        ? 'Switch to client view'
                        : 'Switch to practitioner view'}
                  </Button>
                ) : !isPractitioner ? (
                  <Button variant="outline" className="w-full gap-2" asChild data-testid="nav-mobile-apply">
                    <Link href="/practitioner-signup">
                      <Award className="w-4 h-4" />
                      Apply as a practitioner
                    </Link>
                  </Button>
                ) : null}
                {marketingLinks(true)}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => void signOut()}
                  data-testid="nav-mobile-sign-out"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              {marketingLinks(true)}
              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <Button variant="outline" className="w-full" asChild data-testid="nav-mobile-sign-in">
                  <Link href={signInHref(isMarketing ? undefined : location)}>Sign in</Link>
                </Button>
                {isPractitionerPage ? (
                  <Button className="w-full" asChild data-testid="nav-mobile-cta-practitioner">
                    <Link href="/practitioner-signup">Start your practice</Link>
                  </Button>
                ) : (
                  <Button className="w-full" asChild data-testid="nav-mobile-get-started">
                    <Link href="/sign-up">Get started</Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function RoleBadge({ role }: { role: PortalRole }) {
  return (
    <Badge variant={role === 'client' ? 'secondary' : 'outline'} data-testid="nav-role-badge">
      {role === 'client' ? 'Client' : 'Practitioner'}
    </Badge>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  testId: string;
}) {
  return (
    <DropdownMenuItem asChild>
      <Link href={href} className="flex items-center gap-2 cursor-pointer" data-testid={testId}>
        <Icon className="w-4 h-4" />
        {children}
      </Link>
    </DropdownMenuItem>
  );
}

function AccountMenu() {
  const { user, signOut } = useSession();
  const portal = usePortalSwitch();
  if (!user) return null;

  const isPractitioner = user.activeRole === 'practitioner';
  const holdsBothRoles = user.isClient && user.isPractitioner;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors"
          aria-label="Account menu"
          data-testid="nav-account-menu"
        >
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} />
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-2">
            <RoleBadge role={user.activeRole} />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <MenuLink href="/account" icon={UserRound} testId="menu-account">
          Account
        </MenuLink>
        {isPractitioner ? (
          user.onboardingComplete ? (
            <>
              <MenuLink href="/dashboard" icon={LayoutDashboard} testId="menu-dashboard">
                Dashboard
              </MenuLink>
              <MenuLink href="/schedule" icon={CalendarDays} testId="menu-schedule">
                Schedule
              </MenuLink>
            </>
          ) : (
            <MenuLink href="/practitioner-signup" icon={Award} testId="menu-application">
              Your application
            </MenuLink>
          )
        ) : (
          <MenuLink href="/bookings" icon={CalendarDays} testId="menu-bookings">
            Bookings
          </MenuLink>
        )}
        <MenuLink href="/messages" icon={MessageCircle} testId="menu-messages">
          Messages
        </MenuLink>
        <MenuLink href="/notifications" icon={Bell} testId="menu-notifications">
          Notifications
        </MenuLink>

        {isPractitioner && user.onboardingComplete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              Your practice
            </DropdownMenuLabel>
            {PRACTICE_LINKS.map((link) => (
              <MenuLink key={link.href} href={link.href} icon={link.icon} testId={`menu-${link.testId}`}>
                {link.label}
              </MenuLink>
            ))}
          </>
        ) : null}

        <DropdownMenuSeparator />
        {holdsBothRoles ? (
          <DropdownMenuItem
            onSelect={() => void portal.switchTo(isPractitioner ? 'client' : 'practitioner')}
            disabled={portal.isPending}
            className="flex items-center gap-2 cursor-pointer"
            data-testid="menu-switch-role"
          >
            <Repeat className="w-4 h-4" />
            {isPractitioner ? 'Switch to client view' : 'Switch to practitioner view'}
          </DropdownMenuItem>
        ) : !isPractitioner ? (
          <MenuLink href="/practitioner-signup" icon={Award} testId="menu-apply">
            Apply as a practitioner
          </MenuLink>
        ) : null}
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="flex items-center gap-2 cursor-pointer"
          data-testid="menu-sign-out"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
