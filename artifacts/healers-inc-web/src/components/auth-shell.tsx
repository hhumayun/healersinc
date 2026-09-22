import { type ReactNode } from 'react';
import { Link } from 'wouter';
import logoUrl from '@workspace/healers-inc/logo.svg';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';

/**
 * Centered single-column frame for sign-in / sign-up, matching the mobile
 * app's auth screens: brand mark, heading, description, then the form.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  testId,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-16 px-4 sm:px-6 flex flex-col items-center"
      data-testid={testId}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, hsl(var(--primary) / 0.12) 0%, transparent 65%)',
        }}
      />
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-3 mb-6" data-testid="auth-logo">
          <img src={logoUrl} alt="Healers Inc" className="h-10 w-auto" />
        </Link>
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description ? <CardDescription className="text-base">{description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">{children}</CardContent>
        </Card>
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
