import { eq } from "drizzle-orm";
import {
  db,
  practitionerSignupProgressTable,
  type PractitionerSignupProgress,
  type User,
} from "@workspace/db";
import type { CurrentUser, PortalRole, SignupStep } from "@workspace/api-zod";

export async function loadSignupProgress(
  userId: string,
): Promise<PractitionerSignupProgress | null> {
  const [row] = await db
    .select()
    .from(practitionerSignupProgressTable)
    .where(eq(practitionerSignupProgressTable.userId, userId))
    .limit(1);

  return row ?? null;
}

export function toCurrentUser(
  user: User,
  role: PortalRole,
  progress: PractitionerSignupProgress | null,
): CurrentUser {
  // A client-only account has nothing to onboard, so it is complete by
  // definition; a practitioner is complete once the wizard was finished.
  const onboardingComplete = user.isPractitioner
    ? Boolean(progress?.completedAt)
    : true;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    country: user.country,
    timezone: user.timezone,
    avatarUrl: user.avatarUrl,
    isClient: user.isClient,
    isPractitioner: user.isPractitioner,
    emailVerified: user.emailVerified,
    activeRole: role,
    onboardingStep: (progress?.currentStep ?? "complete") as SignupStep,
    onboardingComplete,
  };
}
