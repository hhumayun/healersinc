import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, LayoutGrid, Pencil, Plus } from 'lucide-react';
import {
  getListMyServicesQueryKey,
  useCreateService,
  useDeleteService,
  useListMyServices,
  useUpdateService,
  SessionFormat,
  type Service,
  type ServiceDraft,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/healers-inc/components/ui/alert-dialog';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/healers-inc/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Switch } from '@workspace/healers-inc/components/ui/switch';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { ChoiceChips } from '@/components/manage/choice-chips';
import { EmptyState, ErrorBanner, ErrorState, Page, PageHeader } from '@/components/page';
import { errorMessage } from '@/lib/errors';
import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';

const FORMAT_OPTIONS = [
  { value: SessionFormat.online, label: 'Online' },
  { value: SessionFormat.phone, label: 'Phone' },
  { value: SessionFormat.in_person, label: 'In person' },
] as const;

const DURATION_OPTIONS = [
  { value: '30', label: '30m' },
  { value: '45', label: '45m' },
  { value: '60', label: '60m' },
  { value: '90', label: '90m' },
  { value: '120', label: '2h' },
] as const;

const DEFAULT_CURRENCY = 'CAD';

type DraftState = {
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
  format: SessionFormat;
  isActive: boolean;
};

const EMPTY_DRAFT: DraftState = {
  name: '',
  description: '',
  durationMinutes: '60',
  price: '',
  format: SessionFormat.online,
  isActive: true,
};

function ServiceRow({
  service,
  onEdit,
  onRetire,
  retiring,
}: {
  service: Service;
  onEdit: () => void;
  onRetire: () => void;
  retiring: boolean;
}) {
  return (
    <Card className={cn(!service.isActive && 'opacity-70')} data-testid={`service-row-${service.id}`}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{service.name}</p>
            {service.description ? (
              <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
            ) : null}
          </div>
          {service.isActive ? null : <Badge variant="outline">Inactive</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{formatDuration(service.durationMinutes)}</Badge>
          <Badge variant="secondary">{sessionFormatLabel[service.format]}</Badge>
          <Badge>{formatMoney(service.priceCents, service.currency)}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={retiring} data-testid={`service-edit-${service.id}`}>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
          {service.isActive ? (
            <Button size="sm" variant="ghost" onClick={onRetire} disabled={retiring} className="text-destructive hover:text-destructive" data-testid={`service-retire-${service.id}`}>
              <Archive className="w-3.5 h-3.5" />
              {retiring ? 'Retiring…' : 'Retire'}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceEditor({
  open,
  editing,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Service | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useCreateService();
  const updateSvc = useUpdateService();
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      editing
        ? {
            name: editing.name,
            description: editing.description,
            durationMinutes: String(editing.durationMinutes),
            price: String(editing.priceCents / 100),
            format: editing.format,
            isActive: editing.isActive,
          }
        : EMPTY_DRAFT,
    );
    setError(null);
  }, [open, editing]);

  const priceCents = useMemo(() => {
    const parsed = Number(draft.price);
    if (!draft.price.trim() || Number.isNaN(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [draft.price]);
  const durationMinutes = Number(draft.durationMinutes);
  const durationValid = !Number.isNaN(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 480;
  const canSave = draft.name.trim().length >= 2 && priceCents != null && durationValid;
  const pending = create.isPending || updateSvc.isPending;
  const knownDuration = DURATION_OPTIONS.some((o) => o.value === draft.durationMinutes);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave || priceCents == null || pending) return;
    setError(null);
    const body: ServiceDraft = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      durationMinutes,
      priceCents,
      currency: editing?.currency ?? currency,
      format: draft.format,
      isActive: draft.isActive,
    };
    const onError = (err: unknown) => setError(errorMessage(err, 'Could not save the service.'));
    if (editing) {
      updateSvc.mutate({ serviceId: editing.id, data: body }, { onSuccess: onSaved, onError });
    } else {
      create.mutate({ data: body }, { onSuccess: onSaved, onError });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto" data-testid="service-editor">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit service' : 'New service'}</DialogTitle>
          <DialogDescription>What clients can book, how long it lasts and what it costs.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="svc-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input id="svc-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Initial consultation" data-testid="svc-name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="svc-description">Description</FieldLabel>
              <Textarea id="svc-description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} placeholder="What this session covers…" data-testid="svc-description" />
            </Field>
            <Field>
              <FieldLabel>
                Duration <span className="text-destructive">*</span>
              </FieldLabel>
              <ChoiceChips label="Duration" options={DURATION_OPTIONS} value={knownDuration ? draft.durationMinutes : null} onChange={(v) => setDraft((d) => ({ ...d, durationMinutes: v }))} testId="svc-duration" />
              {!knownDuration ? (
                <FieldDescription>Currently {formatDuration(durationMinutes)}; pick a preset to change it.</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="svc-price">
                Price <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
                <Input id="svc-price" inputMode="decimal" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="120" className="pl-7" data-testid="svc-price" />
              </div>
              <FieldDescription>Shown in {editing?.currency ?? currency}.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>
                Format <span className="text-destructive">*</span>
              </FieldLabel>
              <ChoiceChips label="Format" options={FORMAT_OPTIONS} value={draft.format} onChange={(format) => setDraft((d) => ({ ...d, format }))} testId="svc-format" />
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <FieldLabel htmlFor="svc-active">Bookable</FieldLabel>
                  <FieldDescription>Inactive services stay listed but cannot be booked.</FieldDescription>
                </div>
                <Switch id="svc-active" checked={draft.isActive} onCheckedChange={(isActive) => setDraft((d) => ({ ...d, isActive }))} data-testid="svc-active" />
              </div>
            </Field>
          </FieldGroup>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || pending} data-testid="svc-save">
              {pending ? 'Saving…' : editing ? 'Save service' : 'Add service'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** `/manage/services` — ported from the Expo manage/services screen. */
export default function ManageServicesPage() {
  const queryClient = useQueryClient();
  const servicesQuery = useListMyServices({ query: { queryKey: getListMyServicesQueryKey() } });
  const del = useDeleteService();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [retiring, setRetiring] = useState<Service | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Services · Healers Inc';
  }, []);

  const currency = servicesQuery.data?.[0]?.currency ?? DEFAULT_CURRENCY;
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: getListMyServicesQueryKey() });

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  function retire(service: Service) {
    setRetiring(null);
    setRetiringId(service.id);
    del.mutate(
      { serviceId: service.id },
      {
        onSuccess: () => {
          setRetiringId(null);
          invalidate();
          toast({ title: `Retired “${service.name}”` });
        },
        onError: (err) => {
          setRetiringId(null);
          toast({
            variant: 'destructive',
            title: 'Could not retire this service',
            description: errorMessage(err, 'This service may have upcoming bookings.'),
          });
        },
      },
    );
  }

  const services = servicesQuery.data ?? [];

  return (
    <Page testId="page-manage-services">
      <PageHeader
        eyebrow="Your practice"
        title="Services"
        description="The sessions clients can book with you."
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={
          <Button onClick={openNew} data-testid="service-add">
            <Plus className="w-4 h-4" />
            Add service
          </Button>
        }
      />

      {servicesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : servicesQuery.isError ? (
        <ErrorState title="Couldn't load your services" error={servicesQuery.error} onRetry={() => void servicesQuery.refetch()} />
      ) : services.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No services yet"
          description="Add your first service so clients know what they can book."
          action={
            <Button onClick={openNew} data-testid="service-add-empty">
              <Plus className="w-4 h-4" />
              Add a service
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="service-list">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              onEdit={() => {
                setEditing(service);
                setEditorOpen(true);
              }}
              onRetire={() => setRetiring(service)}
              retiring={retiringId === service.id}
            />
          ))}
        </div>
      )}

      <ServiceEditor
        open={editorOpen}
        editing={editing}
        currency={currency}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          invalidate();
          toast({ title: editing ? 'Service saved' : 'Service added' });
        }}
      />

      <AlertDialog open={retiring !== null} onOpenChange={(open) => (!open ? setRetiring(null) : undefined)}>
        <AlertDialogContent data-testid="service-retire-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Retire “{retiring?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Clients will no longer be able to book it. It stays in your list marked Inactive so past bookings keep their details, and you can make it active again from Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => retiring && retire(retiring)} data-testid="service-retire-confirm">
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
