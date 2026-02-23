import { useEffect, useMemo, useRef, useState } from 'react';

interface ItemWithCover {
  id: string | number;
  posterPath?: string | null;
  needsCoverArt?: boolean;
}

const globalRequestedIds = new Set<string | number>();
const globalPendingRequests = new Map<string | number, Promise<unknown>>();
let isProcessingBatch = false;
let pendingItems: { id: string | number }[] = [];
const coverDataCache = new Map<string | number, string>();

const processPendingBatch = async (batchSize = 20) => {
  if (isProcessingBatch || pendingItems.length === 0) return;

  isProcessingBatch = true;

  const currentBatch = pendingItems.slice(0, batchSize);
  pendingItems = pendingItems.slice(batchSize);

  const batchIds = currentBatch
    .map((item) => item.id)
    .filter(Boolean)
    .map((id) => String(id));

  if (batchIds.length === 0) {
    isProcessingBatch = false;
    if (pendingItems.length > 0) {
      setTimeout(() => processPendingBatch(batchSize), 50);
    }
    return;
  }

  try {
    const batchUrl = `/api/v1/coverart/batch/${batchIds.join(',')}`;

    const requestPromise = fetch(batchUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Error fetching cover art: ${response.status}`);
        }
        return response.json();
      })
      .then((coverData) => {
        Object.entries(coverData).forEach(([id, url]) => {
          coverDataCache.set(id, url as string);
        });

        batchIds.forEach((id) => globalPendingRequests.delete(id));

        window.dispatchEvent(new CustomEvent('cover-data-updated'));

        return coverData;
      })
      .catch(() => {
        batchIds.forEach((id) => globalPendingRequests.delete(id));
      });

    batchIds.forEach((id) => globalPendingRequests.set(id, requestPromise));

    await requestPromise;

    isProcessingBatch = false;

    if (pendingItems.length > 0) {
      setTimeout(() => processPendingBatch(batchSize), 300);
    }
  } catch (error) {
    isProcessingBatch = false;
    if (pendingItems.length > 0) {
      setTimeout(() => processPendingBatch(batchSize), 300);
    }
  }
};

export function useProgressiveCovers<T extends ItemWithCover>(
  items: T[],
  batchSize = 20
): T[] {
  const itemsRef = useRef<T[]>(items);
  const [coverLoadTrigger, setCoverLoadTrigger] = useState(0);
  const itemsSignatureRef = useRef<string>('');

  useEffect(() => {
    const updateFromCache = () => {
      const newItems = [...itemsRef.current];
      let hasUpdates = false;

      for (let i = 0; i < newItems.length; i++) {
        const item = newItems[i];
        if (item?.id && coverDataCache.has(item.id) && item.needsCoverArt) {
          newItems[i] = {
            ...item,
            posterPath: coverDataCache.get(item.id),
            needsCoverArt: false,
          };
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        itemsRef.current = newItems;
        setCoverLoadTrigger((prev) => prev + 1);
      }
    };

    window.addEventListener('cover-data-updated', updateFromCache);
    return () => {
      window.removeEventListener('cover-data-updated', updateFromCache);
    };
  }, []);

  useEffect(() => {
    const currentSignature = JSON.stringify(items.map((item) => item.id));

    if (currentSignature === itemsSignatureRef.current) {
      return;
    }

    itemsSignatureRef.current = currentSignature;

    const newItems = [...items];
    const oldItemsMap = new Map(
      itemsRef.current.map((item) => [item.id, item])
    );

    let hasChanges = false;
    for (let i = 0; i < newItems.length; i++) {
      if (
        newItems[i]?.id &&
        coverDataCache.has(newItems[i].id) &&
        newItems[i].needsCoverArt
      ) {
        newItems[i] = {
          ...newItems[i],
          posterPath: coverDataCache.get(newItems[i].id),
          needsCoverArt: false,
        };
        hasChanges = true;
        continue;
      }

      const existingItem = oldItemsMap.get(newItems[i].id);
      if (existingItem && existingItem.posterPath && !newItems[i].posterPath) {
        newItems[i] = {
          ...newItems[i],
          posterPath: existingItem.posterPath,
          needsCoverArt: false,
        };
        hasChanges = true;
      }
    }

    if (hasChanges || newItems.length !== itemsRef.current.length) {
      itemsRef.current = newItems;
      setCoverLoadTrigger((prev) => prev + 1);
    }
  }, [items]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enhancedItems = useMemo(() => itemsRef.current, [coverLoadTrigger]);

  useEffect(() => {
    const itemsNeedingCovers = itemsRef.current.filter(
      (item) =>
        item?.needsCoverArt &&
        item?.id &&
        !globalRequestedIds.has(item.id) &&
        !globalPendingRequests.has(item.id) &&
        !coverDataCache.has(item.id)
    );

    if (!itemsNeedingCovers.length) return;

    itemsNeedingCovers.forEach((item) => {
      if (item.id) {
        globalRequestedIds.add(item.id);
        pendingItems.push({ id: item.id });
      }
    });

    if (!isProcessingBatch) {
      processPendingBatch(batchSize);
    }
  }, [coverLoadTrigger, batchSize]);

  return enhancedItems;
}
