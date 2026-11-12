import logger from '@server/logger';
import { proxyRequestInterceptor } from '@server/utils/customProxyAgent';
import { userAgentRequestInterceptor } from '@server/utils/userAgent';
import axios, { type AxiosInstance } from 'axios';
import rateLimit, { type rateLimitOptions } from 'axios-rate-limit';
import { createHash } from 'crypto';
import { promises } from 'fs';
import mime from 'mime';
import path, { join } from 'path';

type ImageResponse = {
  meta: {
    revalidateAfter: number;
    curRevalidate: number;
    isStale: boolean;
    etag: string;
    extension: string | null;
    cacheKey: string;
    cacheMiss: boolean;
  };
  imageBuffer: Buffer;
};

const baseCacheDirectory = process.env.CONFIG_DIRECTORY
  ? `${process.env.CONFIG_DIRECTORY}/cache/images`
  : path.join(__dirname, '../../config/cache/images');

// Every entry also costs a directory block and up to a block of file slack
const ENTRY_OVERHEAD = 8192;

class CacheIndex {
  public totalSize = 0;
  private sizesInWriteOrder = new Map<string, number>();

  public set(cacheKey: string, size: number) {
    this.delete(cacheKey);
    this.sizesInWriteOrder.set(cacheKey, size);
    this.totalSize += size;
  }

  public delete(cacheKey: string) {
    this.totalSize -= this.sizesInWriteOrder.get(cacheKey) ?? 0;
    this.sizesInWriteOrder.delete(cacheKey);
  }

  public evictOldest(maxSize: number): string[] {
    const evicted: string[] = [];

    for (const [cacheKey, size] of this.sizesInWriteOrder) {
      if (this.totalSize <= maxSize) {
        break;
      }

      this.sizesInWriteOrder.delete(cacheKey);
      this.totalSize -= size;
      evicted.push(cacheKey);
    }

    return evicted;
  }
}

class ImageProxy {
  private static cacheIndexes = new Map<string, Promise<CacheIndex>>();

  public static async clearCache(key: string) {
    let deletedImages = 0;
    const cacheDirectory = path.join(baseCacheDirectory, key);
    const cacheIndex = await ImageProxy.cacheIndexes.get(key);

    try {
      const files = await promises.readdir(cacheDirectory);

      for (const file of files) {
        const filePath = path.join(cacheDirectory, file);
        const stat = await promises.lstat(filePath);

        if (stat.isDirectory()) {
          const imageFiles = await promises.readdir(filePath);

          for (const imageFile of imageFiles) {
            const [, expireAtSt] = imageFile.split('.');
            const expireAt = Number(expireAtSt);
            const now = Date.now();

            if (now > expireAt) {
              await promises.rm(path.join(filePath), {
                recursive: true,
              });
              cacheIndex?.delete(file);
              deletedImages += 1;
            }
          }
        }
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return;
      }
      logger.error('Failed to read directory', {
        label: 'Image Cache',
        message: e.message,
      });
    }

    logger.info(`Cleared ${deletedImages} stale image(s) from cache '${key}'`, {
      label: 'Image Cache',
    });
  }

  public static async getImageStats(
    key: string
  ): Promise<{ size: number; imageCount: number }> {
    const cacheDirectory = path.join(baseCacheDirectory, key);

    const imageTotalSize = await ImageProxy.getDirectorySize(cacheDirectory);
    const imageCount = await ImageProxy.getImageCount(cacheDirectory);

    return {
      size: imageTotalSize,
      imageCount,
    };
  }

  private static async getDirectorySize(dir: string): Promise<number> {
    try {
      const files = await promises.readdir(dir, {
        withFileTypes: true,
      });

      const paths = files.map(async (file) => {
        const path = join(dir, file.name);

        if (file.isDirectory()) return await ImageProxy.getDirectorySize(path);

        if (file.isFile()) {
          const { size } = await promises.stat(path);

          return size;
        }

        return 0;
      });

      return (await Promise.all(paths))
        .flat(Infinity)
        .reduce((i, size) => i + size, 0);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return 0;
      }
    }

    return 0;
  }

  private static async getImageCount(dir: string) {
    try {
      const files = await promises.readdir(dir);

      return files.length;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return 0;
      }
    }

    return 0;
  }

  private axios: AxiosInstance;
  private cacheVersion;
  private key;
  private maxCacheSize;
  private pendingWrites = new Map<string, Promise<ImageResponse | null>>();

  constructor(
    key: string,
    baseUrl: string,
    options: {
      cacheVersion?: number;
      rateLimitOptions?: rateLimitOptions;
      headers?: Record<string, string>;
      maxCacheSize?: number;
    } = {}
  ) {
    this.cacheVersion = options.cacheVersion ?? 1;
    this.key = key;
    this.maxCacheSize = options.maxCacheSize;
    this.axios = axios.create({
      baseURL: baseUrl,
      headers: options.headers,
    });
    this.axios.interceptors.request.use(proxyRequestInterceptor);
    this.axios.interceptors.request.use(userAgentRequestInterceptor);

    if (options.rateLimitOptions) {
      this.axios = rateLimit(this.axios, options.rateLimitOptions);
    }
  }

  public async getImage(
    path: string,
    fallbackPath?: string
  ): Promise<ImageResponse> {
    const cacheKey = this.getCacheKey(path);

    const imageResponse = await this.get(cacheKey);

    if (!imageResponse) {
      const newImage = await this.set(path, cacheKey);

      if (!newImage) {
        if (fallbackPath) {
          return await this.getImage(fallbackPath);
        } else {
          throw new Error('Failed to load image');
        }
      }

      return newImage;
    }

    // If the image is stale, we will revalidate it in the background.
    if (imageResponse.meta.isStale) {
      this.set(path, cacheKey);
    }

    return imageResponse;
  }

  public async clearCachedImage(path: string) {
    // find cacheKey
    const cacheKey = this.getCacheKey(path);
    const directory = join(this.getCacheDirectory(), cacheKey);

    try {
      await promises.access(directory);
    } catch (e) {
      if (e.code === 'ENOENT') {
        logger.debug(
          `Cache directory '${cacheKey}' does not exist; nothing to clear.`,
          {
            label: 'Image Cache',
          }
        );
        return;
      } else {
        logger.error('Error checking cache directory existence', {
          label: 'Image Cache',
          message: e.message,
        });
        return;
      }
    }

    try {
      const files = await promises.readdir(directory);

      await promises.rm(directory, { recursive: true });
      (await ImageProxy.cacheIndexes.get(this.key))?.delete(cacheKey);

      logger.debug(`Cleared ${files[0]} from cache 'avatar'`, {
        label: 'Image Cache',
      });
    } catch (e) {
      logger.error('Failed to clear cached image', {
        label: 'Image Cache',
        message: e.message,
      });
    }
  }

  private async get(cacheKey: string): Promise<ImageResponse | null> {
    try {
      const directory = join(this.getCacheDirectory(), cacheKey);
      const files = await promises.readdir(directory);
      const now = Date.now();

      for (const file of files) {
        const [maxAgeSt, expireAtSt, etag, extension] = file.split('.');
        const buffer = await promises.readFile(join(directory, file));
        const expireAt = Number(expireAtSt);
        const maxAge = Number(maxAgeSt);

        return {
          meta: {
            curRevalidate: maxAge,
            revalidateAfter: maxAge * 1000 + now,
            isStale: now > expireAt,
            etag,
            extension,
            cacheKey,
            cacheMiss: false,
          },
          imageBuffer: buffer,
        };
      }
    } catch {
      // No files. Treat as empty cache.
    }

    return null;
  }

  // Parallel writes to one entry would leave files the size limit never counts
  private set(path: string, cacheKey: string): Promise<ImageResponse | null> {
    let pendingWrite = this.pendingWrites.get(cacheKey);

    if (!pendingWrite) {
      pendingWrite = this.fetchAndCache(path, cacheKey).finally(() =>
        this.pendingWrites.delete(cacheKey)
      );
      this.pendingWrites.set(cacheKey, pendingWrite);
    }

    return pendingWrite;
  }

  private async fetchAndCache(
    path: string,
    cacheKey: string
  ): Promise<ImageResponse | null> {
    try {
      const directory = join(this.getCacheDirectory(), cacheKey);
      const response = await this.axios.get(path, {
        responseType: 'arraybuffer',
      });

      const buffer = Buffer.from(response.data, 'binary');

      const contentType = String(response.headers['content-type'] || '');
      const extension = (mime.getExtension(contentType) || '').replace(
        /[^\w-]/g,
        ''
      );

      let maxAge = Number(
        String(response.headers['cache-control'] ?? '0').split('=')[1]
      );

      if (!maxAge) maxAge = 86400;
      const expireAt = Date.now() + maxAge * 1000;
      const etag = (response.headers.etag ?? '').replace(/[^\w-]/g, '');

      await this.writeToCacheDir(
        directory,
        extension,
        maxAge,
        expireAt,
        buffer,
        etag
      );
      await this.trackCacheWrite(cacheKey, buffer.length);

      return {
        meta: {
          curRevalidate: maxAge,
          revalidateAfter: expireAt,
          isStale: false,
          etag,
          extension,
          cacheKey,
          cacheMiss: true,
        },
        imageBuffer: buffer,
      };
    } catch (e) {
      logger.debug('Something went wrong caching image.', {
        label: 'Image Cache',
        errorMessage: e.message,
      });
      return null;
    }
  }

  private async writeToCacheDir(
    dir: string,
    extension: string | null,
    maxAge: number,
    expireAt: number,
    buffer: Buffer,
    etag: string
  ) {
    const filename = join(dir, `${maxAge}.${expireAt}.${etag}.${extension}`);

    await promises.rm(dir, { force: true, recursive: true }).catch(() => {
      // do nothing
    });

    await promises.mkdir(dir, { recursive: true });
    await promises.writeFile(filename, buffer);
  }

  private async trackCacheWrite(cacheKey: string, fileSize: number) {
    if (!this.maxCacheSize) {
      return;
    }

    const cacheIndex = await this.getCacheIndex();
    cacheIndex.set(cacheKey, fileSize + ENTRY_OVERHEAD);

    await Promise.all(
      cacheIndex.evictOldest(this.maxCacheSize).map((evictedKey) =>
        promises
          .rm(join(this.getCacheDirectory(), evictedKey), {
            force: true,
            recursive: true,
          })
          .catch((e) => {
            logger.error('Failed to evict cached image', {
              label: 'Image Cache',
              message: e.message,
            });
          })
      )
    );
  }

  private getCacheIndex() {
    let cacheIndex = ImageProxy.cacheIndexes.get(this.key);

    if (!cacheIndex) {
      cacheIndex = this.loadCacheIndex();
      ImageProxy.cacheIndexes.set(this.key, cacheIndex);
    }

    return cacheIndex;
  }

  private async loadCacheIndex() {
    const cacheDirectory = this.getCacheDirectory();
    const cacheKeys = await promises
      .readdir(cacheDirectory)
      .catch((): string[] => []);
    const entries: { cacheKey: string; size: number; writtenAt: number }[] = [];

    await Promise.all(
      cacheKeys.map(async (cacheKey) => {
        const directory = join(cacheDirectory, cacheKey);

        try {
          const files = await promises.readdir(directory);
          const stats = await Promise.all(
            files.map((file) => promises.stat(join(directory, file)))
          );

          entries.push({
            cacheKey,
            size: stats.reduce(
              (total, stat) => total + stat.size,
              ENTRY_OVERHEAD
            ),
            writtenAt: Math.max(0, ...stats.map((stat) => stat.mtimeMs)),
          });
        } catch {
          // Removed mid-scan, so there is nothing to count
        }
      })
    );

    const cacheIndex = new CacheIndex();

    entries
      .sort((a, b) => a.writtenAt - b.writtenAt)
      .forEach((entry) => cacheIndex.set(entry.cacheKey, entry.size));

    return cacheIndex;
  }

  private getCacheKey(path: string) {
    return this.getHash([this.key, this.cacheVersion, path]);
  }

  private getHash(items: (string | number | Buffer)[]) {
    const hash = createHash('sha256');
    for (const item of items) {
      if (typeof item === 'number') hash.update(String(item));
      else {
        hash.update(item);
      }
    }
    // See https://en.wikipedia.org/wiki/Base64#Filenames
    return hash.digest('base64').replace(/\//g, '-');
  }

  private getCacheDirectory() {
    return path.join(baseCacheDirectory, this.key);
  }
}

export default ImageProxy;
