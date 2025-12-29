import type {
  ActivityHistoryResponse,
  ActivityPopularResponse,
  ActivitySessionsResponse,
  ActivityStatusResponse,
} from '@server/interfaces/api/activityInterfaces';
import useSWR from 'swr';

export const useActivityStatus = () =>
  useSWR<ActivityStatusResponse>('/api/v1/dashboard/status');

export const useActivitySessions = () =>
  useSWR<ActivitySessionsResponse>('/api/v1/dashboard/sessions');

export const useActivityHistory = (mode: 'week' | 'month') =>
  useSWR<ActivityHistoryResponse>(`/api/v1/dashboard/history?mode=${mode}`);

export const useActivityPopular = (days = 30) =>
  useSWR<ActivityPopularResponse>(`/api/v1/dashboard/popular?days=${days}`);
