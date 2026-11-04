import fs from 'fs';
import path from 'path';

export type StringOrReadFileFromEnvOptions = {
  credential?: string;
  asBuffer?: boolean;
};

function errnoCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException).code;
}

function getCredentialsDirectory(): string | undefined {
  if (process.env.CREDENTIALS_DIRECTORY) {
    return process.env.CREDENTIALS_DIRECTORY;
  }

  try {
    if (fs.statSync('/run/secrets').isDirectory()) {
      return '/run/secrets';
    }
  } catch {
    // directory not present
  }

  return undefined;
}

export function stringOrReadFileFromEnv(
  envVar: string,
  options?: StringOrReadFileFromEnvOptions & { asBuffer: true }
): Buffer | string | undefined;
export function stringOrReadFileFromEnv(
  envVar: string,
  options?: StringOrReadFileFromEnvOptions
): string | undefined;
export function stringOrReadFileFromEnv(
  envVar: string,
  options: StringOrReadFileFromEnvOptions = {}
): Buffer | string | undefined {
  const { credential, asBuffer = false } = options;

  const envValue = process.env[envVar];
  if (envValue) {
    if (asBuffer) {
      return envValue;
    }
    const trimmed = envValue.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const filePath = process.env[`${envVar}_FILE`];
  if (filePath) {
    try {
      if (asBuffer) {
        return fs.readFileSync(filePath);
      }
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      return content || undefined;
    } catch (err) {
      throw new Error(
        `ENV ${envVar}_FILE was defined but was unable to be read: ${errnoCode(err) ?? 'unknown error'}`
      );
    }
  }

  const credentialsDirectory = getCredentialsDirectory();
  if (credential && credentialsDirectory) {
    const credentialPath = path.join(credentialsDirectory, credential);
    try {
      if (asBuffer) {
        return fs.readFileSync(credentialPath);
      }
      const content = fs.readFileSync(credentialPath, 'utf-8').trim();
      return content || undefined;
    } catch (err) {
      if (errnoCode(err) === 'ENOENT') {
        return undefined;
      }
      throw new Error(
        `Failed to read credential '${credential}' for ${envVar}: ${errnoCode(err) ?? 'unknown error'}`
      );
    }
  }

  return undefined;
}
