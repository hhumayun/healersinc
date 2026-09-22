import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Info } from 'lucide-react';
import {
  getGetAppointmentQueryKey,
  getListAppointmentsQueryKey,
  useCreateReview,
  useGetAppointment,
  type Appointment,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { errorMessage } from '@/lib/errors';
import {
  EmptyState,
  ErrorBanner,
  ErrorState,
  LoadingBlock,
  Page,
  PageHeader,
} from '@/components/page';
import { StarRating } from '@/components/star-rating';
import { UserAvatar } from '@/components/user-avatar';

/** Same cap as the Expo review form's comment box. */
const COMMENT_MAX_LENGTH = 2000;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

/** `/review/:appointmentId` — ported from the Expo review screen. */
export default function ReviewPage() {
  const { appointmentId = '' } = useParams<{ appointmentId: string }>();
  const id = appointmentId;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const query = useGetAppointment(id, {
    query: { enabled: !!id, queryKey: getGetAppointmentQueryKey(id) },
  });
  const createReview = useCreateReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Write a review · Healers Inc';
  }, []);

  const appointment = query.data;
  const backHref = `/appointment/${id}`;

  function handleSubmit() {
    setSubmitError(null);
    createReview.mutate(
      {
        data: {
          appointmentId: id,
          rating,
          comment: comment.trim() ? comment.trim() : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.setQueryData<Appointment>(getGetAppointmentQueryKey(id), (old) =>
            old ? { ...old, hasReview: true, canReview: false } : old,
          );
          void queryClient.invalidateQueries({ queryKey: getGetAppointmentQueryKey(id) });
          void queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey().slice(0, 1),
          });
          toast({
            title: 'Thanks for your review',
            description: 'Your feedback helps other clients find the right practitioner.',
          });
          navigate(backHref);
        },
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    );
  }

  function renderBody() {
    if (query.isLoading) {
      return <LoadingBlock label="Loading session…" />;
    }
    if (query.isError || !appointment) {
      return (
        <ErrorState
          title="Couldn't load this session"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      );
    }

    if (appointment.hasReview) {
      return (
        <EmptyState
          icon={Check}
          title="Already reviewed"
          description="You've already shared your feedback for this session. Thank you."
          action={
            <Button asChild data-testid="button-back-to-session">
              <Link href={backHref}>Back to session</Link>
            </Button>
          }
        />
      );
    }

    if (!appointment.canReview) {
      return (
        <EmptyState
          icon={Info}
          title="Not available for review"
          description="Only completed sessions you attended can be reviewed."
          action={
            <Button asChild variant="outline" data-testid="button-back-to-session">
              <Link href={backHref}>Back to session</Link>
            </Button>
          }
        />
      );
    }

    const practitioner = appointment.practitioner;

    return (
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!createReview.isPending) handleSubmit();
        }}
        data-testid="review-form"
      >
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UserAvatar
              name={practitioner.fullName}
              avatarUrl={practitioner.avatarUrl}
              className="h-12 w-12"
              fallbackClassName="text-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{practitioner.fullName}</p>
              <p className="text-sm text-muted-foreground truncate">{appointment.serviceName}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            How was your session?
          </p>
          <StarRating value={rating} onChange={setRating} size="lg" />
          <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="rating-label">
            {RATING_LABELS[rating]}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="review-comment">Comment</FieldLabel>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Write a few words about your experience"
            rows={5}
            maxLength={COMMENT_MAX_LENGTH}
            data-testid="input-review-comment"
          />
          <FieldDescription className="flex justify-between gap-4">
            <span>Optional — share what stood out about this session.</span>
            <span className="shrink-0 tabular-nums">
              {comment.length}/{COMMENT_MAX_LENGTH}
            </span>
          </FieldDescription>
        </Field>

        {submitError ? <ErrorBanner message={submitError} /> : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={createReview.isPending}
          data-testid="button-submit-review"
        >
          {createReview.isPending ? 'Submitting…' : 'Submit review'}
        </Button>
      </form>
    );
  }

  return (
    <Page width="narrow" testId="page-review">
      <PageHeader
        eyebrow="Review"
        title="Write a review"
        description="Tell other clients how your session went."
        backHref={backHref}
        backLabel="Back to session"
      />
      {renderBody()}
    </Page>
  );
}
