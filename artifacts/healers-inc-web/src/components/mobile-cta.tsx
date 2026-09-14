import { useState } from 'react';
import { Smartphone, ExternalLink } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@workspace/healers-inc/components/ui/dialog';
import { cn } from '@workspace/healers-inc/lib/utils';

/**
 * The app download prompt. Now that the whole client journey works in a
 * browser this is a secondary option everywhere it appears, never the only
 * way forward.
 */
interface MobileCtaProps {
  label: string;
  appPath?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  testId?: string;
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|mobile/i.test(navigator.userAgent);
}

export function MobileCta({
  label,
  appPath = '/explore',
  variant = 'default',
  size = 'default',
  className,
  testId,
}: MobileCtaProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    if (isMobileDevice()) {
      // On mobile, attempt to open the app or store
      window.location.href = `healers-app://${appPath}`;
    } else {
      setShowDialog(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn('cursor-pointer', className)}
        onClick={handleClick}
        data-testid={testId ?? 'mobile-cta-button'}
      >
        {label}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="sm:max-w-sm"
          data-testid="mobile-cta-dialog"
        >
          <DialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-2 mx-auto">
              <Smartphone className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-xl" data-testid="dialog-title">
              Available on mobile
            </DialogTitle>
            <DialogDescription className="text-center text-base leading-relaxed" data-testid="dialog-description">
              Healers Inc is a mobile-first experience. Download the app on your
              iPhone or Android to discover practitioners, book sessions, and
              manage your care journey.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="dialog-app-store-link"
            >
              <Button variant="default" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" />
                App Store — iPhone &amp; iPad
              </Button>
            </a>
            <a
              href="https://play.google.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="dialog-play-store-link"
            >
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" />
                Google Play — Android
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
