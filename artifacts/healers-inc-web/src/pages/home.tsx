import { useEffect } from 'react';
import { Link } from 'wouter';
import { motion, type Variants } from 'framer-motion';
import {
  Globe,
  ShieldCheck,
  Clock,
  Star,
  ArrowRight,
  Heart,
  Search,
  CalendarCheck,
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

const MODALITIES = [
  'Psychotherapy',
  'Somatic Healing',
  'Acupuncture',
  'Naturopathy',
  'Nutritional Coaching',
  'Energy Work',
  'Mindfulness',
  'Herbalism',
  'Breathwork',
  'Life Coaching',
];

const PRACTITIONERS = [
  {
    id: 1,
    name: 'Dr. Amara Osei',
    specialty: 'Integrative Psychotherapy',
    timezone: 'London, UK',
    rating: '4.97',
    reviews: 142,
    available: true,
  },
  {
    id: 2,
    name: 'Mei Lin Huang',
    specialty: 'Traditional Chinese Medicine',
    timezone: 'Singapore',
    rating: '4.94',
    reviews: 89,
    available: true,
  },
  {
    id: 3,
    name: 'Javier Santos',
    specialty: 'Somatic & Breathwork',
    timezone: 'Buenos Aires',
    rating: '4.98',
    reviews: 211,
    available: false,
  },
];

const STEPS = [
  {
    icon: Search,
    title: 'Discover',
    body: 'Browse vetted practitioners across dozens of modalities. Filter by specialty, language, and availability in your time zone.',
  },
  {
    icon: CalendarCheck,
    title: 'Book',
    body: 'Choose a time that actually works for you. Healers Inc handles every scheduling detail across time zones, automatically.',
  },
  {
    icon: Heart,
    title: 'Heal',
    body: 'Show up as you are. Your practitioner is there — experienced, present, and fully prepared for you.',
  },
];

const TESTIMONIALS = [
  {
    id: 1,
    quote:
      "I live in Tokyo and my therapist is in Cape Town. It used to feel impossible. Healers Inc made it feel obvious.",
    name: 'Keiko M.',
    context: 'Client since 2023',
  },
  {
    id: 2,
    quote:
      'For the first time I found a somatic practitioner who truly speaks my language — literally and figuratively.',
    name: 'Lena B.',
    context: 'Client since 2022',
  },
  {
    id: 3,
    quote:
      'The booking flow is so calm. No anxiety about whether to reach out. I just picked a time and showed up.',
    name: 'Tariq A.',
    context: 'Client since 2024',
  },
];

export default function Home() {
  useEffect(() => {
    document.title = 'Healers Inc — Find Your Practitioner';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Discover vetted wellness practitioners across modalities and time zones. Book with ease, heal on your own terms.');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', 'Healers Inc — Find Your Practitioner');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', 'A two-sided wellness marketplace where care seekers discover practitioners and book time across time zones.');
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background" data-testid="page-home">
      {/* ── HERO ── */}
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 pb-16 overflow-hidden"
        data-testid="section-hero"
        aria-label="Hero"
      >
        {/* Warm ambient background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--secondary)) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, hsl(var(--accent) / 0.12) 0%, transparent 60%)',
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
              variant="secondary"
              className="mb-6 text-xs tracking-wide px-3 py-1"
              data-testid="hero-badge"
            >
              Wellness without borders
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight mb-6"
            data-testid="hero-heading"
          >
            Your care journey,
            <br />
            <span className="text-primary">on your terms.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto"
            data-testid="hero-subheading"
          >
            Healers Inc connects you with vetted, human practitioners across
            modalities, languages, and time zones. No gatekeeping. No waiting
            rooms. Just care that meets you where you are.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row gap-4 items-center justify-center"
          >
            <MobileCta
              label="Find your practitioner"
              size="lg"
              testId="hero-cta-primary"
            />
            <Button
              variant="ghost"
              size="lg"
              asChild
              data-testid="hero-cta-practitioners"
            >
              <Link href="/practitioners" className="gap-2 flex items-center">
                Are you a practitioner?
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          aria-hidden
        >
          <div className="w-px h-10 bg-gradient-to-b from-muted-foreground/40 to-transparent" />
        </motion.div>
      </section>

      {/* ── MODALITIES ── */}
      <section
        className="py-16 bg-secondary/30 overflow-hidden"
        data-testid="section-modalities"
        aria-label="Modalities"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8 text-center">
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground" data-testid="modalities-label">
            Across every discipline
          </p>
        </div>
        <div className="relative">
          {/* First row scrolling left */}
          <div className="flex gap-3 mb-3 animate-[scroll-left_30s_linear_infinite]" style={{ width: 'max-content' }}>
            {[...MODALITIES, ...MODALITIES].map((m, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm text-foreground whitespace-nowrap shrink-0"
                data-testid={`modality-tag-${i}`}
              >
                {m}
              </span>
            ))}
          </div>
          {/* Second row scrolling right */}
          <div className="flex gap-3 animate-[scroll-right_35s_linear_infinite]" style={{ width: 'max-content' }}>
            {[...MODALITIES.slice(5), ...MODALITIES, ...MODALITIES.slice(0, 5)].map((m, i) => (
              <span
                key={i}
                className="px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground whitespace-nowrap shrink-0"
                data-testid={`modality-tag-row2-${i}`}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        className="py-24 px-4 sm:px-6"
        data-testid="section-how-it-works"
        aria-label="How it works"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3" data-testid="how-it-works-label">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="how-it-works-heading">
              Three steps to better care
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                data-testid={`step-card-${i}`}
              >
                <Card className="h-full border-border hover:shadow-md transition-shadow duration-300">
                  <CardHeader className="pb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground/50 tabular-nums">
                        0{i + 1}
                      </span>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRACTITIONER SHOWCASE ── */}
      <section
        className="py-24 px-4 sm:px-6 bg-muted/50"
        data-testid="section-practitioners"
        aria-label="Practitioner showcase"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12"
          >
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3" data-testid="practitioners-label">
                Meet the community
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="practitioners-heading">
                Practitioners who bring their whole selves
              </h2>
            </div>
            <MobileCta
              label="Browse all practitioners"
              variant="outline"
              testId="practitioners-browse-cta"
            />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PRACTITIONERS.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
              >
                <Card
                  className="group border-border hover:shadow-md transition-all duration-300 cursor-default"
                  data-testid={`practitioner-card-${p.id}`}
                >
                  <CardContent className="p-6">
                    {/* Avatar area */}
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-primary-foreground"
                        style={{
                          background: `hsl(var(--primary) / ${0.7 + i * 0.1})`,
                        }}
                        data-testid={`practitioner-avatar-${p.id}`}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <Badge
                        variant={p.available ? 'default' : 'outline'}
                        className="text-xs"
                        data-testid={`practitioner-availability-${p.id}`}
                      >
                        {p.available ? 'Available now' : 'Waitlist open'}
                      </Badge>
                    </div>

                    <h3 className="font-semibold text-foreground mb-0.5" data-testid={`practitioner-name-${p.id}`}>
                      {p.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4" data-testid={`practitioner-specialty-${p.id}`}>
                      {p.specialty}
                    </p>

                    <Separator className="mb-4" />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        <span data-testid={`practitioner-timezone-${p.id}`}>{p.timezone}</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                        <span data-testid={`practitioner-rating-${p.id}`}>{p.rating}</span>
                        <span className="text-muted-foreground font-normal">({p.reviews})</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY HEALERS INC ── */}
      <section
        className="py-24 px-4 sm:px-6"
        data-testid="section-why"
        aria-label="Why Healers Inc"
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
              Why Healers Inc
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="why-heading">
              Designed around the care relationship
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: 'Vetted practitioners',
                body: 'Every practitioner on Healers Inc goes through a rigorous credentialing process. Your safety and wellbeing come first.',
                id: 'vetted',
              },
              {
                icon: Globe,
                title: 'Seamless across time zones',
                body: 'We handle the timezone arithmetic. Book a session in Tokyo with a practitioner in Toronto without a second thought.',
                id: 'timezones',
              },
              {
                icon: Clock,
                title: 'On your schedule',
                body: 'Care should fit your life, not the other way around. Browse and book on your terms, 24 hours a day.',
                id: 'schedule',
              },
            ].map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
                data-testid={`why-card-${item.id}`}
              >
                <div className="flex gap-5">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mt-0.5">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section
        className="py-24 px-4 sm:px-6"
        style={{ background: 'radial-gradient(ellipse 100% 70% at 50% 50%, hsl(var(--secondary) / 0.5) 0%, transparent 70%)' }}
        data-testid="section-testimonials"
        aria-label="Testimonials"
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
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="testimonials-heading">
              Real people. Real care.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.45 }}
                data-testid={`testimonial-card-${t.id}`}
              >
                <Card className="h-full border-border">
                  <CardContent className="p-7">
                    {/* Decorative quote mark */}
                    <div className="text-4xl font-serif text-primary/30 leading-none mb-4" aria-hidden>
                      &ldquo;
                    </div>
                    <p className="text-foreground leading-relaxed mb-6" data-testid={`testimonial-quote-${t.id}`}>
                      {t.quote}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground" data-testid={`testimonial-name-${t.id}`}>
                          {t.name}
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`testimonial-context-${t.id}`}>
                          {t.context}
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
        className="py-24 px-4 sm:px-6 bg-primary"
        data-testid="section-final-cta"
        aria-label="Call to action"
      >
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-5"
              data-testid="final-cta-heading"
            >
              Your practitioner is waiting.
            </h2>
            <p
              className="text-base sm:text-lg text-primary-foreground/80 mb-10 leading-relaxed"
              data-testid="final-cta-body"
            >
              Take the first step toward intentional, human-centered care.
              Discover practitioners who see you, wherever you are in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <MobileCta
                label="Get started — it's free"
                variant="secondary"
                size="lg"
                testId="final-cta-primary"
              />
              <Link
                href="/practitioners"
                className={cn(
                  'text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors underline underline-offset-4'
                )}
                data-testid="final-cta-practitioners"
              >
                Joining as a practitioner?
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
