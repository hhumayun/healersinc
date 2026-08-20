import type { notificationTypeEnum } from "@workspace/db";

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
