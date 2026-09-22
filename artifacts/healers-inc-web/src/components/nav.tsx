import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  getListConversationsQueryKey,
  getListNotificationsQueryKey,
  useListConversations,
  useListNotifications,
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
  Bell,
  CalendarDays,
  ChevronDown,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import logoUrl from '@workspace/healers-inc/logo.svg';
import { MobileCta } from '@/components/mobile-cta';
import { UserAvatar } from '@/components/user-avatar';
import { useSession } from '@/lib/session';
import { signInHref } from '@/components/require-client';

const MARKETING_PATHS = new Set(['/', '/practitioners']);

const CLIENT_LINKS = [
  { href: '/discover', label: 'Discover', icon: Search, testId: 'discover' },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays, testId: 'bookings' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, testId: 'messages' },
] as const;

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

  const signedIn = status === 'authenticated' && user !== null;
  const onboarded = signedIn && (user.isClient || user.isPractitioner);
  const isMarketing = MARKETING_PATHS.has(location);
  const isPractitionerPage = location === '/practitioners';

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

  const clientLinks = (mobile = false) =>
    CLIENT_LINKS.map((link) => {
      const unread =
        link.href === '/messages' ? unreadMessages : 0;
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
          {onboarded ? clientLinks() : marketingLinks()}
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
                <MobileCta
                  label="Start your practice"
                  appPath="/practitioner-signup"
                  size="sm"
                  testId="nav-cta-practitioner"
                />
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
          menuOpen ? 'max-h-[80dvh] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0',
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
              {clientLinks(true)}
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
              <div className="pt-2 border-t border-border flex flex-col gap-2">
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
                <Button className="w-full" asChild data-testid="nav-mobile-get-started">
                  <Link href="/sign-up">Get started</Link>
                </Button>
                {isPractitionerPage ? (
                  <MobileCta
                    label="Start your practice"
                    appPath="/practitioner-signup"
                    variant="ghost"
                    className="w-full"
                    size="sm"
                    testId="nav-mobile-cta-practitioner"
                  />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function RoleBadge({ role }: { role: 'client' | 'practitioner' }) {
  return (
    <Badge variant={role === 'client' ? 'secondary' : 'outline'} data-testid="nav-role-badge">
      {role === 'client' ? 'Client' : 'Practitioner'}
    </Badge>
  );
}

function AccountMenu() {
  const { user, signOut } = useSession();
  if (!user) return null;

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
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2 cursor-pointer" data-testid="menu-account">
            <UserRound className="w-4 h-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/bookings" className="flex items-center gap-2 cursor-pointer" data-testid="menu-bookings">
            <CalendarDays className="w-4 h-4" />
            Bookings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/messages" className="flex items-center gap-2 cursor-pointer" data-testid="menu-messages">
            <MessageCircle className="w-4 h-4" />
            Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="flex items-center gap-2 cursor-pointer" data-testid="menu-notifications">
            <Bell className="w-4 h-4" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
