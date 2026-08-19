import { Guidelines } from './parts';

const logoUrl = `${import.meta.env.BASE_URL}logo.svg`;
const logoSvgUrl = logoUrl;

export function LogoPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Primary mark</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The Healers Inc mark — a warm, layered leaf. Pair it with the
          wordmark set in DM Sans bold italic.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex h-40 items-center justify-center rounded-lg border bg-white">
            <img src={logoUrl} alt="Healers Inc logo on light" className="h-16 w-16" />
          </div>
          <div className="flex h-40 items-center justify-center rounded-lg bg-[#17140f]">
            <img src={logoUrl} alt="Healers Inc logo on dark" className="h-16 w-16" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border bg-background p-4">
          <img src={logoSvgUrl} alt="" className="h-9 w-9" />
          <span className="text-xl font-bold italic tracking-tight">
            Healers Inc
          </span>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Usage</h2>
        <div className="mt-4">
          <Guidelines
            items={[
              {
                kind: 'do',
                text: 'Place the mark on white or very light surfaces, as in the product header and footer.',
              },
              {
                kind: 'do',
                text: 'Keep clear space around the mark of at least half its width.',
              },
              {
                kind: 'dont',
                text: 'Recolor the mark or place it over busy photography.',
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
