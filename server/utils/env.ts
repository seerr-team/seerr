import fs from 'fs';

export function stringOrReadFileFromEnv(envVar: string): string | undefined {
    if (process.env[envVar]) {
        return process.env[envVar];
    }
    const filePath = process.env[`${envVar}_FILE`];
    if (filePath) {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (err) {
            throw new Error(`ENV ${envVar}_FILE was defined but was unable to be read from ${filePath}: ${(err as Error).message}`)
        }

    }
    return undefined;
}