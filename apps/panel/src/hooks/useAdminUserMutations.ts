import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';

interface UseAdminUserMutationsOptions {
  /** Detay sayfasında kullanıcı önbelleğini de yeniler */
  detailUserId?: string;
  onSuspendSuccess?: () => void;
  onRoleSuccess?: () => void;
}

export function useAdminUserMutations(options?: UseAdminUserMutationsOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const detailUserId = options?.detailUserId;

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    if (detailUserId) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user', detailUserId] });
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'user', detailUserId, 'audit-log'],
      });
    }
  };

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/users/${userId}/suspend`);
    },
    onSuccess: () => {
      invalidate();
      options?.onSuspendSuccess?.();
      toast.success(t('admin.users.toast.suspended'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.patch(`/admin/users/${userId}/unsuspend`);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t('admin.users.toast.unsuspended'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const roleMutation = useMutation({
    mutationFn: async (payload: { id: string; role: string }) => {
      await api.patch(`/admin/users/${payload.id}/role`, { role: payload.role });
    },
    onSuccess: () => {
      invalidate();
      options?.onRoleSuccess?.();
      toast.success(t('admin.users.toast.roleUpdated'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const sessionsMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/admin/users/${userId}/sessions`);
    },
    onSuccess: () => {
      toast.success(t('admin.users.toast.sessionsEnded'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/admin/users/${userId}/reset-password`);
    },
    onSuccess: () => {
      toast.success(t('admin.users.toast.resetEmailSent'));
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  });

  return {
    suspendMutation,
    unsuspendMutation,
    roleMutation,
    sessionsMutation,
    resetPasswordMutation,
  };
}
