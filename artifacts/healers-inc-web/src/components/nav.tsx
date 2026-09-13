import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@workspace/healers-inc/lib/utils';
import { Menu, X } from 'lucide-react';
import logoUrl from '@workspace/healers-inc/logo.svg';
import { MobileCta } from '@/components/mobile-cta';

export function Nav() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isPractitioner = location === '/practitioners';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  return (
    <header
      data-testid="site-nav"
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" data-testid="nav-logo" className="flex items-center gap-3 shrink-0">
          <img
            src={logoUrl}
            alt="Healers Inc"
            className="h-8 w-auto"
            data-testid="logo-image"
          />
          <span className="font-semibold text-base text-foreground tracking-tight">
            Healers Inc
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
          <Link
            href="/"
            data-testid="nav-link-clients"
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              !isPractitioner
                ? 'text-primary bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            For Clients
          </Link>
          <Link
            href="/practitioners"
            data-testid="nav-link-practitioners"
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              isPractitioner
                ? 'text-primary bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            For Practitioners
          </Link>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <MobileCta
            label={isPractitioner ? 'Start your practice' : 'Find your practitioner'}
            appPath={isPractitioner ? '/practitioner-signup' : '/explore'}
            size="sm"
            testId={isPractitioner ? 'nav-cta-practitioner' : 'nav-cta-client'}
          />
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-md text-foreground hover:bg-muted transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          data-testid="nav-mobile-toggle"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        data-testid="nav-mobile-menu"
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300 bg-background border-b border-border',
          menuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="px-4 py-4 flex flex-col gap-2">
          <Link
            href="/"
            data-testid="nav-mobile-link-clients"
            className={cn(
              'px-4 py-3 rounded-md text-sm font-medium transition-colors',
              !isPractitioner
                ? 'text-primary bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            For Clients
          </Link>
          <Link
            href="/practitioners"
            data-testid="nav-mobile-link-practitioners"
            className={cn(
              'px-4 py-3 rounded-md text-sm font-medium transition-colors',
              isPractitioner
                ? 'text-primary bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            For Practitioners
          </Link>
          <div className="pt-2 border-t border-border">
            <MobileCta
              label={isPractitioner ? 'Start your practice' : 'Find your practitioner'}
              appPath={isPractitioner ? '/practitioner-signup' : '/explore'}
              className="w-full"
              size="sm"
              testId={
                isPractitioner
                  ? 'nav-mobile-cta-practitioner'
                  : 'nav-mobile-cta-client'
              }
            />
          </div>
        </div>
      </div>
    </header>
  );
}
