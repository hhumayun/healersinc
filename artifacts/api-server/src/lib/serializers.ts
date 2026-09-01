import type {
  Appointment as AppointmentDto,
  AvailabilityException as AvailabilityExceptionDto,
  Conversation as ConversationDto,
  Message as MessageDto,
  Notification as NotificationDto,
  PartyRef,
  PractitionerCard,
  Review as ReviewDto,
  PaymentSummary,
  Service as ServiceDto,
} from "@workspace/api-zod";
import type {
  Appointment,
  AvailabilityException,
  Message,
  Notification,
  PractitionerProfile,
  Review,
  Service,
  User,
} from "@workspace/db";
import { formatInZone } from "@workspace/scheduling";

const APPOINTMENT_LABEL_FORMAT = "EEE d LLL, h:mm a";

export function toPartyRef(
  user: Pick<User, "id" | "fullName" | "avatarUrl" | "timezone">,
  headline?: string | null,
): PartyRef {
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    headline: headline ?? null,
    timezone: user.timezone,
  };
}

export function toService(service: Service): ServiceDto {
  return {
    id: service.id,
    practitionerId: service.practitionerId,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    currency: service.currency,
    format: service.format,
    isActive: service.isActive,
  };
}

export interface PractitionerCardInput {
  user: User;
  profile: PractitionerProfile;
  services: Service[];
  nextAvailableAt?: Date | null;
  viewerTimezone?: string;
}

export function toPractitionerCard(
  input: PractitionerCardInput,
): PractitionerCard {
  const activeServices = input.services.filter((service) => service.isActive);
  const prices = activeServices.map((service) => service.priceCents);
  const formats = [...new Set(activeServices.map((service) => service.format))];

  return {
    id: input.user.id,
    fullName: input.user.fullName,
    headline: input.profile.headline,
    modality: input.profile.modality ?? "mind",
    avatarUrl: input.user.avatarUrl,
    coverPhotoUrl: input.profile.photos[0] ?? null,
    languages: input.profile.languages,
    tags: input.profile.tags,
    location: input.profile.location,
    timezone: input.profile.timezone,
    hourlyRateCents: input.profile.hourlyRateCents,
    fromPriceCents: prices.length ? Math.min(...prices) : null,
    currency: input.profile.currency,
    ratingAverage: input.profile.ratingAverage
      ? Number(input.profile.ratingAverage)
      : null,
    ratingCount: input.profile.ratingCount,
    formats,
    nextAvailableAt: input.nextAvailableAt ?? null,
    nextAvailableLabel: input.nextAvailableAt
      ? formatInZone(
          input.nextAvailableAt,
          input.viewerTimezone ?? input.profile.timezone,
          APPOINTMENT_LABEL_FORMAT,
        )
      : null,
  };
}

export interface AppointmentInput {
  appointment: Appointment;
  client: User;
  practitioner: User;
  practitionerHeadline?: string | null;
  viewerId: string;
  hasReview: boolean;
  payment?: PaymentSummary | null;
}

export function toAppointment(input: AppointmentInput): AppointmentDto {
  const { appointment } = input;
  const viewerRole = input.viewerId === appointment.clientId ? "client" : "practitioner";

  const viewerTimezone =
    viewerRole === "client"
      ? appointment.clientTimezone
      : appointment.practitionerTimezone;
  const counterpartTimezone =
    viewerRole === "client"
      ? appointment.practitionerTimezone
      : appointment.clientTimezone;

  return {
    id: appointment.id,
    status: appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    serviceName: appointment.serviceName,
    serviceDurationMinutes: appointment.serviceDurationMinutes,
    servicePriceCents: appointment.servicePriceCents,
    serviceCurrency: appointment.serviceCurrency,
    serviceFormat: appointment.serviceFormat,
    clientTimezone: appointment.clientTimezone,
    practitionerTimezone: appointment.practitionerTimezone,
    viewerTimezone,
    viewerLabel: formatInZone(
      appointment.startsAt,
      viewerTimezone,
      APPOINTMENT_LABEL_FORMAT,
    ),
    counterpartLabel: formatInZone(
      appointment.startsAt,
      counterpartTimezone,
      APPOINTMENT_LABEL_FORMAT,
    ),
    clientNotes: appointment.clientNotes,
    cancellationReason: appointment.cancellationReason,
    cancelledLate: appointment.cancelledLate,
    client: toPartyRef(input.client),
    practitioner: toPartyRef(input.practitioner, input.practitionerHeadline),
    viewerRole,
    canReview:
      viewerRole === "client" &&
      appointment.status === "completed" &&
      !input.hasReview,
    hasReview: input.hasReview,
    payment: input.payment ?? null,
    createdAt: appointment.createdAt,
  };
}

export function toAvailabilityException(
  exception: AvailabilityException,
): AvailabilityExceptionDto {
  return {
    id: exception.id,
    kind: exception.kind,
    startDate: exception.startDate,
    endDate: exception.endDate,
    startMinute: exception.startMinute,
    endMinute: exception.endMinute,
    note: exception.note,
  };
}

export function toMessage(message: Message, viewerId: string): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
    mine: message.senderId === viewerId,
  };
}

export interface ConversationInput {
  id: string;
  otherParty: User;
  otherPartyHeadline?: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export function toConversation(input: ConversationInput): ConversationDto {
  return {
    id: input.id,
    otherParty: toPartyRef(input.otherParty, input.otherPartyHeadline),
    lastMessageAt: input.lastMessageAt,
    lastMessagePreview: input.lastMessagePreview,
    unreadCount: input.unreadCount,
    blockedByMe: input.blockedByMe,
    blockedByThem: input.blockedByThem,
  };
}

export function toNotification(notification: Notification): NotificationDto {
  const data = (notification.data ?? {}) as Record<string, unknown>;

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    appointmentId:
      typeof data["appointmentId"] === "string" ? data["appointmentId"] : null,
    conversationId:
      typeof data["conversationId"] === "string" ? data["conversationId"] : null,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export interface ReviewInput {
  review: Review;
  client: User;
  serviceName: string;
}

export function toReview(input: ReviewInput): ReviewDto {
  return {
    id: input.review.id,
    appointmentId: input.review.appointmentId,
    practitionerId: input.review.practitionerId,
    rating: input.review.rating,
    comment: input.review.comment,
    clientName: input.client.fullName,
    clientAvatarUrl: input.client.avatarUrl,
    serviceName: input.serviceName,
    createdAt: input.review.createdAt,
  };
}
