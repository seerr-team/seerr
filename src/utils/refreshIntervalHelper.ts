import type { DownloadingItem } from '@server/lib/downloadtracker';

export const refreshIntervalHelper = (
  downloadItem: {
    downloadStatus: DownloadingItem[] | undefined;
    downloadStatusAlt: DownloadingItem[] | undefined;
  },
  timer: number
) => {
  if (
    (downloadItem.downloadStatus ?? []).length > 0 ||
    (downloadItem.downloadStatusAlt ?? []).length > 0
  ) {
    return timer;
  } else {
    return 0;
  }
};
