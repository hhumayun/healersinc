import { z } from "zod/v4";

const supportedCountrySchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().regex(/^[A-Z]{2}$/)).min(1));

const feeSchema = z.coerce.number().int().min(0).max(10_000);
const enabledSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, name: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid ${name} configuration.`);
  return parsed.data;
}

export const paymentPolicy = {
  enabled: parseOrThrow(
    enabledSchema,
    process.env["PAYMENTS_ENABLED"] ?? "false",
    "PAYMENTS_ENABLED",
  ),
  supportedCountries: new Set(
    parseOrThrow(
      supportedCountrySchema,
      process.env["PAYMENT_SUPPORTED_COUNTRIES"] ?? "CA,US,GB,AU",
      "PAYMENT_SUPPORTED_COUNTRIES",
    ),
  ),
  platformFeeBasisPoints: parseOrThrow(
    feeSchema,
    process.env["PAYMENT_PLATFORM_FEE_BPS"] ?? "1000",
    "PAYMENT_PLATFORM_FEE_BPS",
  ),
};

const countryAliases: Record<string, "CA" | "US" | "GB" | "AU"> = {
  CA: "CA",
  CANADA: "CA",
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  GB: "GB",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  AU: "AU",
  AUSTRALIA: "AU",
};

export function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  return countryAliases[normalized] ?? (/^[A-Z]{2}$/.test(normalized) ? normalized : null);
}

export function countryIsEligible(value: string | null | undefined): boolean {
  const country = normalizeCountry(value);
  return country !== null && paymentPolicy.supportedCountries.has(country);
}

export function calculateFee(amountCents: number): number {
  return Math.round((amountCents * paymentPolicy.platformFeeBasisPoints) / 10_000);
}