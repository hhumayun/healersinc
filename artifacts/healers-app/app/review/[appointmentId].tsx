import React, { useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAppointmentQueryKey,
  useCreateReview,
  useGetAppointment,
  type Appointment,
} from '@workspace/api-client-react';
import { radii, space, useTheme, withAlpha } from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  Empty,
  Field,
  LoadingState,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { StarRating } from '@/components/StarRating';
import { mediaUrl } from '@/lib/api';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Something went wrong.';
}

export default function ReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const id = appointmentId ?? '';

  const query = useGetAppointment(id, {
    query: { enabled: !!id, queryKey: getGetAppointmentQueryKey(id) },
  });
  const createReview = useCreateReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const appointment = query.data;

  const handleSubmit = () => {
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
          queryClient.setQueryData<Appointment>(
            getGetAppointmentQueryKey(id),
            (old) => (old ? { ...old, hasReview: true, canReview: false } : old),
          );
          router.back();
        },
        onError: (error) => setSubmitError(errorMessage(error)),
      },
    );
  };

  const renderBody = () => {
    if (query.isLoading) {
      return <LoadingState label="Loading session" />;
    }
    if (query.isError || !appointment) {
      return (
        <View style={{ gap: space(4), paddingVertical: space(8) }}>
          <Text variant="body" tone="muted" align="center">
            {errorMessage(query.error)}
          </Text>
          <Button
            title="Try again"
            variant="outline"
            onPress={() => void query.refetch()}
          />
        </View>
      );
    }

    if (appointment.hasReview) {
      return (
        <Empty
          title="Already reviewed"
          description="You've already shared your feedback for this session. Thank you."
          media={<Feather name="check" size={26} color={colors.primary} />}
          actionLabel="Done"
          onAction={() => router.back()}
        />
      );
    }

    if (!appointment.canReview) {
      return (
        <Empty
          title="Not available for review"
          description="Only completed sessions you attended can be reviewed."
          media={<Feather name="info" size={26} color={colors.primary} />}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      );
    }

    const practitioner = appointment.practitioner;

    return (
      <View style={{ gap: space(6) }}>
        <Card>
          <CardContent
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(3),
              padding: space(4),
            }}
          >
            <Avatar
              uri={mediaUrl(practitioner.avatarUrl)}
              name={practitioner.fullName}
              size={48}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{practitioner.fullName}</Text>
              <Text variant="caption" tone="muted">
                {appointment.serviceName}
              </Text>
            </View>
          </CardContent>
        </Card>

        <View style={{ alignItems: 'center', gap: space(3) }}>
          <Text variant="label" tone="muted">
            HOW WAS YOUR SESSION?
          </Text>
          <StarRating value={rating} onChange={setRating} size={40} />
        </View>

        <Field
          label="Comment"
          hint="Optional — share what stood out about this session."
        >
          <Textarea
            value={comment}
            onChangeText={setComment}
            placeholder="Write a few words about your experience"
            rows={5}
            maxLength={2000}
          />
        </Field>

        {submitError ? (
          <View
            style={{
              backgroundColor: withAlpha(colors.destructive, 0.1),
              padding: space(3),
              borderRadius: radii.md,
            }}
          >
            <Text variant="small" tone="destructive">
              {submitError}
            </Text>
          </View>
        ) : null}

        <Button
          title="Submit review"
          fullWidth
          loading={createReview.isPending}
          onPress={handleSubmit}
        />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Write a review', presentation: 'modal' }} />
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: space(5), gap: space(4) }}
      >
        {renderBody()}
      </KeyboardAwareScrollViewCompat>
    </>
  );
}
