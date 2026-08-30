import { Link } from 'wouter';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import logoUrl from '@workspace/healers-inc/logo.svg';

export function Footer() {
  return (
    <footer className="bg-card border-t border-border" data-testid="site-footer">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/" data-testid="footer-logo" className="flex items-center gap-3 mb-4">
              <img
                src={logoUrl}
                alt="Healers Inc"
                className="h-7 w-auto"
                data-testid="footer-logo-image"
              />
              <span className="font-semibold text-foreground">Healers Inc</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-56">
              A considered wellness marketplace connecting seekers and practitioners across time zones.
            </p>
          </div>

          {/* Platform */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Platform
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/"
                  data-testid="footer-link-clients"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  For Clients
                </Link>
              </li>
              <li>
                <Link
                  href="/practitioners"
                  data-testid="footer-link-practitioners"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  For Practitioners
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Company
            </p>
            <ul className="space-y-2.5">
              <li>
                <span
                  className="text-sm text-muted-foreground/50 cursor-default"
                  data-testid="footer-link-about"
                >
                  About
                </span>
              </li>
              <li>
                <span
                  className="text-sm text-muted-foreground/50 cursor-default"
                  data-testid="footer-link-blog"
                >
                  Blog
                </span>
              </li>
              <li>
                <span
                  className="text-sm text-muted-foreground/50 cursor-default"
                  data-testid="footer-link-careers"
                >
                  Careers
                </span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Legal
            </p>
            <ul className="space-y-2.5">
              <li>
                <span
                  className="text-sm text-muted-foreground/50 cursor-default"
                  data-testid="footer-link-privacy"
                >
                  Privacy Policy
                </span>
              </li>
              <li>
                <span
                  className="text-sm text-muted-foreground/50 cursor-default"
                  data-testid="footer-link-terms"
                >
                  Terms of Service
                </span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" data-testid="footer-copyright">
            &copy; {new Date().getFullYear()} Healers Inc. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground" data-testid="footer-tagline">
            Care without borders. Practice without limits.
          </p>
        </div>
      </div>
    </footer>
  );
}
