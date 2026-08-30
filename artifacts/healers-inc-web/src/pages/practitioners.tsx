import { useEffect } from 'react';
import { Link } from 'wouter';
import { motion, type Variants } from 'framer-motion';
import {
  DollarSign,
  Users,
  Globe,
  BarChart3,
  ArrowRight,
  Sparkles,
  Lock,
  CalendarDays,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { cn } from '@workspace/healers-inc/lib/utils';
import { MobileCta } from '@/components/mobile-cta';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const FEATURES = [
  {
    icon: Users,
    title: 'A client base that finds you',
    body: 'Your profile surfaces to care seekers who are actively looking for your modality, your language, your approach. No cold outreach required.',
    id: 'clients',
  },
  {
    icon: Globe,
    title: 'Timezone-aware scheduling',
    body: 'Offer sessions in your local time. Healers Inc converts them for every client, everywhere. You never think about UTC again.',
    id: 'timezone',
  },
  {
    icon: DollarSign,
    title: 'Fair, transparent revenue',
    body: 'Set your own rates. Keep the majority of what you earn. No surprise fees, no hidden platform cuts that grow over time.',
    id: 'revenue',
  },
  {
    icon: Lock,
    title: 'Your practice, your data',
    body: "Client relationships and session notes belong to you. We're infrastructure, not an intermediary who owns your professional network.",
    id: 'data',
  },
  {
    icon: CalendarDays,
    title: 'Scheduling that respects your limits',
    body: 'Set your availability, buffer times, and session caps. Healers Inc enforces them automatically so you can protect your energy.',
    id: 'scheduling',
  },
  {
    icon: BarChart3,
    title: 'Practice insights',
    body: 'Understand how your practice is growing. Track sessions, ratings, and client retention — without surveillance-style monitoring.',
    id: 'insights',
  },
];

const PRACTITIONER_STORIES = [
  {
    id: 1,
    name: 'Nadia K.',
    specialty: 'Somatic Therapist',
    location: 'Berlin, Germany',
    quote:
      "I went from running a local practice to having clients in eight countries. Healers Inc gave me the infrastructure to scale without losing intimacy.",
  },
  {
    id: 2,
    name: 'Kwame D.',
    specialty: 'Nutritional Practitioner',
    location: 'Accra, Ghana',
    quote:
      'My income tripled in the first year. The platform gets out of the way and lets the work speak for itself.',
  },
  {
    id: 3,
    name: 'Sonia R.',
    specialty: 'Mindfulness Coach',
    location: 'São Paulo, Brazil',
    quote:
      'The timezone handling alone saved me hours a week. I just wake up, look at my calendar, and see confirmed sessions.',
  },
];

const PROCESS_STEPS = [
  {
    title: 'Apply',
    body: 'Tell us about your training, credentials, and the people you most want to serve. We read every application personally.',
  },
  {
    title: 'Set up your profile',
    body: 'Create a profile that reflects your voice and philosophy — not a resume. Your future clients are looking for a person, not a credential.',
  },
  {
    title: 'Go live',
    body: "Once approved, your profile is discoverable. Clients find you, book, and pay — all within the app. You just show up.",
  },
];

const SUPPORT_ITEMS = [
  'Dedicated onboarding support',
  'Practitioner community and peer learning',
  'In-app messaging with clients',
  'Session notes and client management',
  'Flexible payment schedule',
  'Insurance and liability guidance (select markets)',
];

export default function Practitioners() {
  useEffect(() => {
    document.title = 'Healers Inc — Grow Your Practice';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Build a sustainable, global wellness practice on Healers Inc. Set your rates, own your clients, and reach care seekers across time zones.');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', 'Healers Inc — Grow Your Practice');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', 'A practitioner-first wellness marketplace. Set your own rates, keep your client data, and serve clients anywhere in the world.');
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background" data-testid="page-practitioners">

      {/* ── HERO ── */}
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 pb-16 overflow-hidden"
        data-testid="section-pract-hero"
        aria-label="Practitioner hero"
      >
        {/* Ambient background — accent-blue tinted to echo the logo's blues, warm undertones */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--accent) / 0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 80% 90%, hsl(var(--primary) / 0.12) 0%, transparent 60%)',
          }}
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={fadeUp} custom={0}>
            <Badge
              variant="outline"
              className="mb-6 text-xs tracking-wide px-3 py-1 border-accent/40 text-accent"
              data-testid="pract-hero-badge"
            >
              For wellness practitioners
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight mb-6"
            data-testid="pract-hero-heading"
          >
            Build the practice
            <br />
            <span className="text-accent">you were trained for.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto"
            data-testid="pract-hero-subheading"
          >
            Healers Inc is the platform designed around practitioners — your
            rates, your clients, your methods. We provide the infrastructure.
            You bring the healing.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          >
            <MobileCta
              label="Apply to join"
              appPath="/practitioner-signup"
              size="lg"
              testId="pract-hero-cta-primary"
            />
            <Button
              variant="ghost"
              size="lg"
              asChild
              data-testid="pract-hero-cta-clients"
            >
              <Link href="/" className="gap-2 flex items-center">
                Looking for care?
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </motion.div>

          {/* Trust stats */}
          <motion.div
            variants={fadeUp}
            custom={4}
            className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-14 pt-10 border-t border-border"
          >
            {[
              { value: '2,400+', label: 'Active practitioners', id: 'stat-practitioners' },
              { value: '94%', label: 'Retention rate', id: 'stat-retention' },
              { value: '58', label: 'Countries served', id: 'stat-countries' },
            ].map((s) => (
              <div key={s.id} className="text-center" data-testid={s.id}>
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section
        className="py-24 px-4 sm:px-6 bg-muted/40"
        data-testid="section-features"
        aria-label="Platform features"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
              Built for practitioners
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="features-heading">
              Everything you need, nothing you don&apos;t.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                data-testid={`feature-card-${feat.id}`}
              >
                <Card className="h-full border-border hover:shadow-md transition-shadow duration-300">
                  <CardHeader className="pb-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                      <feat.icon className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-base">{feat.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {feat.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW JOINING WORKS ── */}
      <section
        className="py-24 px-4 sm:px-6"
        data-testid="section-join-process"
        aria-label="Joining process"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
                How joining works
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-10" data-testid="join-heading">
                From application to first session in days.
              </h2>

              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden />
                <div className="space-y-8 relative">
                  {PROCESS_STEPS.map((step, i) => (
                    <div
                      key={step.title}
                      className="flex gap-6"
                      data-testid={`join-step-${i}`}
                    >
                      <div className="shrink-0 w-10 h-10 rounded-full bg-card border-2 border-primary flex items-center justify-center z-10 font-bold text-primary text-sm">
                        {i + 1}
                      </div>
                      <div className="pt-1">
                        <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                <MobileCta
                  label="Start your application"
                  appPath="/practitioner-signup"
                  size="lg"
                  testId="join-cta"
                />
              </div>
            </motion.div>

            {/* Support list */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <Card className="border-border p-2" data-testid="support-card">
                <CardHeader>
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">What we provide</CardTitle>
                  <CardDescription>
                    Healers Inc supports your practice end-to-end, from your first listing to long-term growth.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {SUPPORT_ITEMS.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-foreground"
                        data-testid={`support-item-${item.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRACTITIONER STORIES ── */}
      <section
        className="py-24 px-4 sm:px-6"
        style={{ background: 'radial-gradient(ellipse 100% 70% at 50% 50%, hsl(var(--accent) / 0.07) 0%, transparent 70%)' }}
        data-testid="section-pract-stories"
        aria-label="Practitioner stories"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
              From the community
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="stories-heading">
              Practitioners speak for themselves.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRACTITIONER_STORIES.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
                data-testid={`pract-story-card-${story.id}`}
              >
                <Card className="h-full border-border">
                  <CardContent className="p-7">
                    <div className="text-4xl font-serif text-accent/30 leading-none mb-4" aria-hidden>
                      &ldquo;
                    </div>
                    <p className="text-foreground leading-relaxed mb-6" data-testid={`story-quote-${story.id}`}>
                      {story.quote}
                    </p>
                    <Separator className="mb-5" />
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-sm font-bold text-accent">
                        {story.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground" data-testid={`story-name-${story.id}`}>
                          {story.name}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`story-specialty-${story.id}`}>
                          {story.specialty} &middot; {story.location}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 px-4 sm:px-6 relative overflow-hidden"
        data-testid="section-pract-final-cta"
        aria-label="Final call to action"
        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-5"
              data-testid="pract-final-heading"
            >
              Ready to build something lasting?
            </h2>
            <p
              className="text-base sm:text-lg text-primary-foreground/80 mb-10 leading-relaxed"
              data-testid="pract-final-body"
            >
              Join thousands of practitioners who chose Healers Inc to expand
              their reach, simplify their operations, and serve clients with
              intention — anywhere in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <MobileCta
                label="Apply now — it's free"
                appPath="/practitioner-signup"
                variant="secondary"
                size="lg"
                testId="pract-final-cta-primary"
              />
              <Link
                href="/"
                className={cn(
                  'text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors underline underline-offset-4'
                )}
                data-testid="pract-final-cta-clients"
              >
                Looking for a practitioner instead?
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
