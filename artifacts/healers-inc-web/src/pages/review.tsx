import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  getGetAppointmentQueryKey,
  getListAppointmentsQueryKey,
  useCreateReview,
  useGetAppointment,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';

import { EmptyState } from '@/pages/discover';
import { PageLoader, RequireClient } from '@/components/route-guards';
import { StarRating } from '@/components/star-rating';
import { errorMessage } from '@/lib/errors';

export default function ReviewPage() {
  return (
    <RequireClient>
      <ReviewForm />
    </RequireClient>
  );
}

function ReviewForm() {
  const params = useParams<{ id: string }>();
  const appointmentId = params.id ?? '';
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const query = useGetAppointment(appointmentId, {
    query: {
      queryKey: getGetAppointmentQueryKey(appointmentId),
      enabled: !!appointmentId,
    },
  });
  const appointment = query.data;
  const createReview = useCreateReview();

  useEffect(() => {
    document.title = 'Leave a review — Healers Inc';
  }, []);

  if (query.isLoading) return <PageLoader label="Loading your session…" />;

  if (query.isError || !appointment) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load this session"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" asChild>
                <Link href="/bookings">Back to your sessions</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  if (!appointment.canReview || appointment.hasReview) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title={
              appointment.hasReview
                ? 'You already reviewed this session'
                : 'This session cannot be reviewed yet'
            }
            description={
              appointment.hasReview
                ? 'Thank you — your review is already published on the practitioner profile.'
                : 'Reviews open once a session is complete.'
            }
            action={
              <Button variant="outline" asChild>
                <Link href={`/bookings/${appointmentId}`}>Back to the session</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    createReview.mutate(
      {
        data: {
          appointmentId,
          rating,
          comment: comment.trim() ? comment.trim() : null,
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getGetAppointmentQueryKey(appointmentId),
          });
          void queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey(),
          });
          navigate(`/bookings/${appointmentId}`, { replace: true });
        },
        onError: (error) =>
          setFormError(errorMessage(error, 'We could not publish your review.')),
      },
    );
  };

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-review"
    >
      <div className="max-w-xl mx-auto">
        <Link
          href={`/bookings/${appointmentId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to the session
        </Link>

        <h1 className="text-3xl font-bold text-foreground tracking-tight mt-2 mb-2">
          How was your session?
        </h1>
        <p className="text-muted-foreground mb-8">
          {appointment.serviceName} with {appointment.practitioner.fullName}
        </p>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <Field>
                <FieldLabel htmlFor="rating">Your rating</FieldLabel>
                <div id="rating">
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
                <FieldDescription>
                  {rating} out of 5 — this appears on the practitioner's profile.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="comment">Your review</FieldLabel>
                <Textarea
                  id="comment"
                  rows={5}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What was helpful? What should others know?"
                  data-testid="input-comment"
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>

              {formError ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 text-sm text-destructive"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                  {formError}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={createReview.isPending}
                data-testid="button-publish-review"
              >
                {createReview.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    Publishing…
                  </>
                ) : (
                  'Publish review'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
