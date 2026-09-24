import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { subscriptionApi } from '@/api/subscription';
import { DEVICE_ALIAS_MAX_LENGTH } from '@/constants/devices';
import { useDestructiveConfirm } from '@/platform/hooks/useNativeDialog';
import { useHaptic } from '@/platform';
import { useTheme } from '@/hooks/useTheme';
import { getGlassColors } from '@/utils/glassTheme';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

/**
 * «Мои устройства»: список, переименование, удаление одного и всех.
 * Перенесено из Subscription.tsx без изменения поведения — теперь тот же
 * список есть и на вкладке «Устройства».
 */
export function DevicesPanel({ subscriptionId }: { subscriptionId: number | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const destructiveConfirm = useDestructiveConfirm();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);

  // Devices query
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices', subscriptionId],
    queryFn: () => subscriptionApi.getDevices(subscriptionId),
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: (hwid: string) => subscriptionApi.deleteDevice(hwid, subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  // Delete all devices mutation
  const deleteAllDevicesMutation = useMutation({
    mutationFn: () => subscriptionApi.deleteAllDevices(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
    },
  });

  // Local device alias (rename) state. Only one device can be in edit-mode
  // at a time — `editingDeviceHwid` doubles as both the toggle and the
  // identifier of the row being edited.
  const [editingDeviceHwid, setEditingDeviceHwid] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  const renameDeviceMutation = useMutation({
    mutationFn: ({ hwid, name }: { hwid: string; name: string | null }) =>
      subscriptionApi.renameDevice(hwid, name, subscriptionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices', subscriptionId] });
      // Soft success-tap, like other mutations on this page.
      haptic.notification('success');
      // Не сбрасываем edit-state, если пользователь уже перешёл на другой
      // девайс пока шёл запрос — иначе теряем его новый input. Имя не чистим
      // безусловно: оно либо принадлежит уже другому девайсу (нужно сохранить),
      // либо инпут уже закрылся (значение не отображается).
      setEditingDeviceHwid((current) => (current === variables.hwid ? null : current));
    },
    onError: () => {
      haptic.notification('error');
    },
  });

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: g.cardBg,
        border: `1px solid ${g.cardBorder}`,
        boxShadow: g.shadow,
        padding: '24px 28px',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-dark-50">
          {t('subscription.myDevices')}
        </h2>
        {devicesData && devicesData.devices.length > 0 && (
          <button
            onClick={async () => {
              // Platform-aware destructive confirm: Telegram native popup
              // in Mini App, inline panel on web. Replaces the bare
              // browser confirm() which broke premium frame + lost
              // haptic / theming inside Telegram.
              const confirmed = await destructiveConfirm(
                t('subscription.confirmDeleteAllDevices'),
                t('subscription.deleteAllDevices'),
                t('subscription.deleteAllDevices'),
              );
              if (confirmed) deleteAllDevicesMutation.mutate();
            }}
            disabled={deleteAllDevicesMutation.isPending}
            className="text-[11px] font-medium transition-colors"
            style={{ color: 'rgb(var(--color-critical-500))' }}
          >
            {t('subscription.deleteAllDevices')}
          </button>
        )}
      </div>

      {devicesLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : devicesData && devicesData.devices.length > 0 ? (
        <div className="space-y-2">
          <div className="mb-2 font-mono text-[11px] text-dark-400">
            {devicesData.device_limit === 0
              ? `${devicesData.total} · ∞`
              : `${devicesData.total} / ${t('subscription.devices', { count: devicesData.device_limit })}`}
          </div>
          {devicesData.devices.map((device) => {
            const isEditing = editingDeviceHwid === device.hwid;
            // Display priority: user alias → device model → platform.
            const displayName =
              (device.local_name && device.local_name.trim()) ||
              device.device_model ||
              device.platform;

            return (
              <div
                key={device.hwid}
                className="flex items-center justify-between rounded-[12px] p-3.5"
                style={{
                  background: g.innerBg,
                  border: `1px solid ${g.innerBorder}`,
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: g.trackBg }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      style={{ stroke: g.textSecondary }}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingDeviceName}
                        maxLength={DEVICE_ALIAS_MAX_LENGTH}
                        placeholder={device.device_model || device.platform}
                        onChange={(e) => setEditingDeviceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = editingDeviceName.trim();
                            renameDeviceMutation.mutate({
                              hwid: device.hwid,
                              name: trimmed || null,
                            });
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingDeviceHwid(null);
                            setEditingDeviceName('');
                          }
                        }}
                        className="w-full rounded-md border-none bg-transparent px-2 py-1 text-sm font-semibold text-dark-50 outline-none focus:ring-1"
                        style={{
                          background: g.trackBg,
                          boxShadow: `inset 0 0 0 1px ${g.innerBorder}`,
                        }}
                      />
                    ) : (
                      <div className="truncate text-sm font-semibold text-dark-50">
                        {displayName}
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-dark-400">
                      <span className="truncate">{device.platform}</span>
                      <span className="font-mono text-dark-400">
                        {device.hwid.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = editingDeviceName.trim();
                          renameDeviceMutation.mutate({
                            hwid: device.hwid,
                            name: trimmed || null,
                          });
                        }}
                        disabled={renameDeviceMutation.isPending}
                        className="p-2 transition-colors"
                        style={{ color: g.textSecondary }}
                        title={t('subscription.renameDeviceSave', 'Сохранить')}
                        aria-label={t('subscription.renameDeviceSave', 'Сохранить')}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeviceHwid(null);
                          setEditingDeviceName('');
                        }}
                        disabled={renameDeviceMutation.isPending}
                        className="p-2 transition-colors"
                        style={{ color: g.textFaint }}
                        title={t('subscription.renameDeviceCancel', 'Отмена')}
                        aria-label={t('subscription.renameDeviceCancel', 'Отмена')}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDeviceHwid(device.hwid);
                          setEditingDeviceName(device.local_name || '');
                        }}
                        className="p-2 transition-colors"
                        style={{ color: g.textFaint }}
                        title={t('subscription.renameDevice', 'Переименовать')}
                        aria-label={t('subscription.renameDevice', 'Переименовать')}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await destructiveConfirm(
                            t('subscription.confirmDeleteDevice'),
                            t('subscription.deleteDevice'),
                            t('subscription.deleteDevice'),
                          );
                          if (confirmed) deleteDeviceMutation.mutate(device.hwid);
                        }}
                        disabled={deleteDeviceMutation.isPending}
                        className="p-2 transition-colors"
                        style={{ color: g.textFaint }}
                        title={t('subscription.deleteDevice')}
                        aria-label={t('subscription.deleteDevice')}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-[12px] text-dark-400">
          {t('subscription.noDevices')}
        </div>
      )}
    </div>
  );
}
