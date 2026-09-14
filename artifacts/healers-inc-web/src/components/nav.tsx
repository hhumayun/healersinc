import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@workspace/healers-inc/lib/utils';
import {
  Bell,
  CalendarDays,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Smartphone,
  X,
} from 'lucide-react';
import logoUrl from '@workspace/healers-inc/logo.svg';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/healers-inc/components/ui/dropdown-menu';

import { CountBadge } from '@/components/count-badge';
import { useAccountBadges } from '@/hooks/use-account-badges';
import { mediaUrl } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Pages that keep the original transparent-over-hero treatment. */
const MARKETING_ROUTES = ['/', '/practitioners'];

const SIGNED_IN_LINKS = [
  { href: '/discover', label: 'Discover', icon: Search },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Nav() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { status, user, signOut } = useSession();
  const { unreadNotifications, unreadMessages } = useAccountBadges();

  const isMarketing = MARKETING_ROUTES.includes(location);
  const isPractitionerPage = location === '/practitioners';
  const signedIn = status === 'authenticated' && !!user;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Only the marketing hero sits under a transparent bar; every other page
  // needs a readable bar from the first pixel.
  const solid = scrolled || !isMarketing || menuOpen;

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
        <Link
          href="/"
          data-testid="nav-logo"
          className="flex items-center gap-3 shrink-0"
        >
          <img
            src={logoUrl}
            alt="Healers Inc"
            className="h-8 w-auto"
            data-testid="logo-image"
          />
          <span className="font-semibold text-base text-foreground tracking-tight hidden sm:inline">
            Healers Inc
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
          {signedIn ? (
            SIGNED_IN_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={location.startsWith(link.href)}
                testId={`nav-link-${link.label.toLowerCase()}`}
                badge={
                  'badge' in link && link.badge === 'messages' ? unreadMessages : 0
                }
              />
            ))
          ) : (
            <>
              <NavLink
                href="/"
                label="For Clients"
                active={location === '/'}
                testId="nav-link-clients"
              />
              <NavLink
                href="/practitioners"
                label="For Practitioners"
                active={isPractitionerPage}
                testId="nav-link-practitioners"
              />
              <NavLink
                href="/discover"
                label="Discover"
                active={location.startsWith('/discover')}
                testId="nav-link-discover"
              />
            </>
          )}
        </nav>

        {/* Desktop account area */}
        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                asChild
                data-testid="nav-notifications"
              >
                <Link href="/notifications" className="relative">
                  <Bell className="w-5 h-5" aria-hidden />
                  <span className="sr-only">Notifications</span>
                  <CountBadge
                    count={unreadNotifications}
                    className="absolute -top-1 -right-1 border-2 border-background"
                    testId="nav-notifications-count"
                  />
                </Link>
              </Button>
              <AccountMenu
                name={user.fullName}
                email={user.email}
                avatarUrl={user.avatarUrl}
                role={user.activeRole}
                onSignOut={() => void signOut()}
              />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild data-testid="nav-sign-in">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" asChild data-testid="nav-get-started">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-md text-foreground hover:bg-muted transition-colors relative"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          data-testid="nav-mobile-toggle"
        >
          {menuOpen ? (
            <X className="w-5 h-5" aria-hidden />
          ) : (
            <Menu className="w-5 h-5" aria-hidden />
          )}
          {!menuOpen && signedIn && unreadNotifications + unreadMessages > 0 ? (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        data-testid="nav-mobile-menu"
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 bg-background border-b border-border',
          menuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 py-4 flex flex-col gap-1">
          {signedIn ? (
            <>
              <MobileAccountHeader
                name={user.fullName}
                email={user.email}
                avatarUrl={user.avatarUrl}
                role={user.activeRole}
              />
              {SIGNED_IN_LINKS.map((link) => (
                <MobileLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={<link.icon className="w-4 h-4" aria-hidden />}
                  active={location.startsWith(link.href)}
                  testId={`nav-mobile-link-${link.label.toLowerCase()}`}
                  badge={
                    'badge' in link && link.badge === 'messages' ? unreadMessages : 0
                  }
                />
              ))}
              <MobileLink
                href="/notifications"
                label="Notifications"
                icon={<Bell className="w-4 h-4" aria-hidden />}
                active={location.startsWith('/notifications')}
                testId="nav-mobile-link-notifications"
                badge={unreadNotifications}
              />
              <MobileLink
                href="/account"
                label="Account"
                icon={<Settings className="w-4 h-4" aria-hidden />}
                active={location.startsWith('/account')}
                testId="nav-mobile-link-account"
              />
              <div className="pt-2 mt-1 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => void signOut()}
                  data-testid="nav-mobile-sign-out"
                >
                  <LogOut className="w-4 h-4" aria-hidden />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <MobileLink
                href="/discover"
                label="Discover practitioners"
                icon={<Search className="w-4 h-4" aria-hidden />}
                active={location.startsWith('/discover')}
                testId="nav-mobile-link-discover"
              />
              <MobileLink
                href="/"
                label="For Clients"
                active={location === '/'}
                testId="nav-mobile-link-clients"
              />
              <MobileLink
                href="/practitioners"
                label="For Practitioners"
                active={isPractitionerPage}
                testId="nav-mobile-link-practitioners"
              />
              <div className="pt-3 mt-2 border-t border-border flex flex-col gap-2">
                <Button asChild className="w-full" data-testid="nav-mobile-get-started">
                  <Link href="/sign-up">Get started</Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className="w-full"
                  data-testid="nav-mobile-sign-in"
                >
                  <Link href="/sign-in">Sign in</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
  testId,
  badge = 0,
}: {
  href: string;
  label: string;
  active: boolean;
  testId: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 flex items-center gap-2',
        active
          ? 'text-primary bg-secondary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      {label}
      <CountBadge count={badge} />
    </Link>
  );
}

function MobileLink({
  href,
  label,
  icon,
  active,
  testId,
  badge = 0,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  testId: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        'px-4 py-3 rounded-md text-sm font-medium transition-colors flex items-center gap-3',
        active
          ? 'text-primary bg-secondary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <CountBadge count={badge} />
    </Link>
  );
}

function RoleBadge({ role }: { role: 'client' | 'practitioner' }) {
  return (
    <Badge
      variant={role === 'practitioner' ? 'outline' : 'secondary'}
      className="text-[10px] uppercase tracking-wide"
      data-testid="account-role"
    >
      {role === 'practitioner' ? 'Practitioner' : 'Client'}
    </Badge>
  );
}

function AccountMenu({
  name,
  email,
  avatarUrl,
  role,
  onSignOut,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'client' | 'practitioner';
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Account menu"
          data-testid="nav-account-menu"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={mediaUrl(avatarUrl)} alt="" />
            <AvatarFallback className="text-xs font-semibold text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1.5">
          <span className="font-semibold truncate">{name}</span>
          <span className="text-xs font-normal text-muted-foreground truncate">
            {email}
          </span>
          <span>
            <RoleBadge role={role} />
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="account-menu-bookings">
          <Link href="/bookings" className="gap-2 cursor-pointer">
            <CalendarDays className="w-4 h-4" aria-hidden />
            Bookings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="account-menu-notifications">
          <Link href="/notifications" className="gap-2 cursor-pointer">
            <Bell className="w-4 h-4" aria-hidden />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="account-menu-account">
          <Link href="/account" className="gap-2 cursor-pointer">
            <Settings className="w-4 h-4" aria-hidden />
            Account settings
          </Link>
        </DropdownMenuItem>
        {role === 'practitioner' ? (
          <DropdownMenuItem asChild data-testid="account-menu-practice">
            <Link href="/practitioners" className="gap-2 cursor-pointer">
              <Smartphone className="w-4 h-4" aria-hidden />
              Practice tools
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onSignOut}
          className="gap-2 cursor-pointer"
          data-testid="account-menu-sign-out"
        >
          <LogOut className="w-4 h-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileAccountHeader({
  name,
  email,
  avatarUrl,
  role,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'client' | 'practitioner';
}) {
  return (
    <div
      className="flex items-center gap-3 px-2 pb-3 mb-2 border-b border-border"
      data-testid="nav-mobile-account"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={mediaUrl(avatarUrl)} alt="" />
        <AvatarFallback className="text-xs font-semibold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <RoleBadge role={role} />
    </div>
  );
}
