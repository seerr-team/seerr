import fs from 'fs';

export function stringOrReadFileFromEnv(envVar: string): string | undefined {
    if (process.env[envVar]) {
        return process.env[envVar];
    }
    const filePath = process.env[`${envVar}_FILE`];
    if (filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return undefined;
}