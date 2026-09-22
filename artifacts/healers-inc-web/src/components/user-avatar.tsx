import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';
import { cn } from '@workspace/healers-inc/lib/utils';

import { mediaUrl } from '@/lib/api';

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** Avatar with initials fallback; accepts API-relative or absolute image paths. */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      <AvatarImage src={mediaUrl(avatarUrl)} alt={name} />
      <AvatarFallback
        className={cn('text-xs font-semibold bg-secondary text-primary', fallbackClassName)}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
