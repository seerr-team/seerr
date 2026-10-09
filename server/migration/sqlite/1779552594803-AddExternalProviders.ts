import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalProviders1779552594803 implements MigrationInterface {
  name = 'AddExternalProviders1779552594803';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "external_provider" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "url" varchar NOT NULL, "authType" varchar NOT NULL DEFAULT ('none'), "apiKey" varchar, "apiKeyHeader" varchar, "bearerToken" varchar, "cacheMinutes" integer NOT NULL DEFAULT (60), "idType" varchar NOT NULL DEFAULT ('tmdb'), "mediaType" varchar NOT NULL DEFAULT ('mixed'), "itemsPath" varchar, "tmdbIdPath" varchar, "tvdbIdPath" varchar, "mediaTypePath" varchar, "defaultMediaType" varchar, "enabled" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "external_provider"`);
  }
}
