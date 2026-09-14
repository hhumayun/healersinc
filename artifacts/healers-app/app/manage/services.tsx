import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
import { useQueryClient } from '@tanstack/react-query';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Segmented,
  SkeletonList,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenScroll, SCREEN_PADDING } from '@/components/Screen';
import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';
import { confirm, notify } from '@/lib/dialog';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

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

function ServiceRow({
  service,
  onEdit,
  onDelete,
  deleting,
}: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: space(3), opacity: service.isActive ? 1 : 0.6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space(2),
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{service.name}</Text>
          {service.description ? (
            <Text variant="small" tone="muted" numberOfLines={2}>
              {service.description}
            </Text>
          ) : null}
        </View>
        {service.isActive ? null : (
          <Badge label="Inactive" variant="muted" size="sm" />
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        <Badge
          label={formatDuration(service.durationMinutes)}
          variant="secondary"
          size="sm"
        />
        <Badge
          label={sessionFormatLabel[service.format]}
          variant="secondary"
          size="sm"
        />
        <Badge
          label={formatMoney(service.priceCents, service.currency)}
          variant="default"
          size="sm"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Button
          title="Edit"
          size="sm"
          variant="outline"
          onPress={onEdit}
          disabled={deleting}
          icon={<Feather name="edit-2" size={14} color={colors.foreground} />}
        />
        {service.isActive ? (
          <Button
            title="Retire"
            size="sm"
            variant="ghost"
            onPress={onDelete}
            loading={deleting}
            icon={
              <Feather name="archive" size={14} color={colors.destructive} />
            }
          />
        ) : null}
      </View>
    </Card>
  );
}

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

function ServiceEditor({
  visible,
  editing,
  currency,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: Service | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreateService();
  const updateSvc = useUpdateService();

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDraft({
        name: editing.name,
        description: editing.description,
        durationMinutes: String(editing.durationMinutes),
        price: String(editing.priceCents / 100),
        format: editing.format,
        isActive: editing.isActive,
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
    setError(null);
  }, [visible, editing]);

  const priceCents = useMemo(() => {
    const parsed = Number(draft.price);
    if (!draft.price.trim() || Number.isNaN(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [draft.price]);

  const durationMinutes = Number(draft.durationMinutes);
  const durationValid =
    !Number.isNaN(durationMinutes) &&
    durationMinutes >= 15 &&
    durationMinutes <= 480;

  const canSave =
    draft.name.trim().length >= 2 && priceCents != null && durationValid;

  const pending = create.isPending || updateSvc.isPending;

  const submit = () => {
    if (!canSave || priceCents == null) return;
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

    const onError = (err: unknown) =>
      setError(errorMessage(err, 'Could not save the service.'));

    if (editing) {
      updateSvc.mutate(
        { serviceId: editing.id, data: body },
        { onSuccess: onSaved, onError },
      );
    } else {
      create.mutate({ data: body }, { onSuccess: onSaved, onError });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingTop: insets.top + space(3),
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: space(3),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="h2">{editing ? 'Edit service' : 'New service'}</Text>
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel="Close"
            onPress={onClose}
            icon={<Feather name="x" size={22} color={colors.foreground} />}
          />
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: insets.bottom + space(24),
            gap: space(4),
          }}
        >
          <Field label="Name" required>
            <Input
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="Initial consultation"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={draft.description}
              onChangeText={(description) =>
                setDraft((d) => ({ ...d, description }))
              }
              rows={3}
              placeholder="What this session covers…"
            />
          </Field>

          <Field label="Duration" required>
            <Segmented
              options={DURATION_OPTIONS}
              value={draft.durationMinutes}
              onChange={(durationMinutes) =>
                setDraft((d) => ({ ...d, durationMinutes }))
              }
            />
          </Field>

          <Field
            label="Price"
            required
            hint={`Informational only, shown in ${editing?.currency ?? currency}.`}
          >
            <Input
              value={draft.price}
              onChangeText={(price) => setDraft((d) => ({ ...d, price }))}
              keyboardType="decimal-pad"
              placeholder="120"
              icon={
                <Text variant="body" tone="muted">
                  $
                </Text>
              }
            />
          </Field>

          <Field label="Format" required>
            <Segmented
              options={FORMAT_OPTIONS}
              value={draft.format}
              onChange={(format) => setDraft((d) => ({ ...d, format }))}
            />
          </Field>

          <Field
            label="Availability"
            hint="Inactive services stay listed but cannot be booked."
          >
            <Segmented
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={draft.isActive ? 'active' : 'inactive'}
              onChange={(v) =>
                setDraft((d) => ({ ...d, isActive: v === 'active' }))
              }
            />
          </Field>

          {error ? (
            <Text variant="small" tone="destructive">
              {error}
            </Text>
          ) : null}

          <Button
            title={editing ? 'Save service' : 'Add service'}
            fullWidth
            onPress={submit}
            loading={pending}
            disabled={!canSave}
          />
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

export default function ManageServicesScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const servicesQuery = useListMyServices();
  const del = useDeleteService();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currency = servicesQuery.data?.[0]?.currency ?? DEFAULT_CURRENCY;

  const openNew = () => {
    setEditing(null);
    setEditorVisible(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setEditorVisible(true);
  };

  const onSaved = () => {
    setEditorVisible(false);
    void queryClient.invalidateQueries({
      queryKey: getListMyServicesQueryKey(),
    });
  };

  const confirmDelete = async (service: Service) => {
    const ok = await confirm({
      title: `Retire “${service.name}”?`,
      message:
        'Clients will no longer be able to book it. It stays in your list marked Inactive so past bookings keep their details, and you can make it active again from Edit.',
      confirmLabel: 'Retire',
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(service.id);
    del.mutate(
      { serviceId: service.id },
      {
        onSuccess: () => {
          setDeletingId(null);
          void queryClient.invalidateQueries({
            queryKey: getListMyServicesQueryKey(),
          });
        },
        onError: (err) => {
          setDeletingId(null);
          void notify(
            'Could not retire this service',
            errorMessage(err, 'This service may have upcoming bookings.'),
          );
        },
      },
    );
  };

  return (
    <>
      <ScreenScroll
        edges={false}
        onRefresh={() => void servicesQuery.refetch()}
        refreshing={servicesQuery.isRefetching}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="small" tone="muted" style={{ flex: 1 }}>
            The sessions clients can book with you.
          </Text>
          <Button
            title="Add"
            size="sm"
            onPress={openNew}
            icon={
              <Feather name="plus" size={16} color={colors.primaryForeground} />
            }
          />
        </View>

        {servicesQuery.isLoading ? (
          <SkeletonList count={3} />
        ) : servicesQuery.isError ? (
          <Card variant="outline" style={{ gap: space(3), alignItems: 'flex-start' }}>
            <Text variant="small" tone="muted">
              {errorMessage(servicesQuery.error, 'Could not load your services.')}
            </Text>
            <Button
              title="Try again"
              variant="outline"
              size="sm"
              onPress={() => void servicesQuery.refetch()}
            />
          </Card>
        ) : servicesQuery.data && servicesQuery.data.length > 0 ? (
          <View style={{ gap: space(3) }}>
            {servicesQuery.data.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                onEdit={() => openEdit(service)}
                onDelete={() => confirmDelete(service)}
                deleting={deletingId === service.id}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              backgroundColor: withAlpha(colors.primary, 0.04),
              borderRadius: radii.lg,
            }}
          >
            <Empty
              title="No services yet"
              description="Add your first service so clients know what they can book."
              media={<Feather name="grid" size={26} color={colors.primary} />}
              actionLabel="Add a service"
              onAction={openNew}
            />
          </View>
        )}
      </ScreenScroll>

      <ServiceEditor
        visible={editorVisible}
        editing={editing}
        currency={currency}
        onClose={() => setEditorVisible(false)}
        onSaved={onSaved}
      />
    </>
  );
}
