import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMusicSupport1714310036946 implements MigrationInterface {
  name = 'AddMusicSupport1714310036946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaLimit" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaDays" integer`);

    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);

    await queryRunner.query(
      `CREATE TABLE "temporary_media" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "tmdbId" integer,
        "tvdbId" integer,
        "imdbId" varchar,
        "mbId" varchar,
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "mediaAddedAt" datetime,
        "serviceId" integer,
        "serviceId4k" integer,
        "externalServiceId" integer,
        "externalServiceId4k" integer,
        "externalServiceSlug" varchar,
        "externalServiceSlug4k" varchar,
        "ratingKey" varchar,
        "ratingKey4k" varchar,
        "jellyfinMediaId" varchar,
        "jellyfinMediaId4k" varchar
      )`
    );

    await queryRunner.query(
      `INSERT INTO "temporary_media"(
        "id", "mediaType", "tmdbId", "tvdbId", "imdbId",
        "status", "status4k", "createdAt", "updatedAt",
        "lastSeasonChange", "mediaAddedAt", "serviceId",
        "serviceId4k", "externalServiceId", "externalServiceId4k",
        "externalServiceSlug", "externalServiceSlug4k",
        "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k"
      ) SELECT
        "id", "mediaType", "tmdbId", "tvdbId", "imdbId",
        "status", "status4k", "createdAt", "updatedAt",
        "lastSeasonChange", "mediaAddedAt", "serviceId",
        "serviceId4k", "externalServiceId", "externalServiceId4k",
        "externalServiceSlug", "externalServiceSlug4k",
        "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k"
      FROM "media"`
    );

    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);

    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaLimit"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaDays"`);

    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);

    await queryRunner.query(
      `CREATE TABLE "temporary_media" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "tmdbId" integer NOT NULL,
        "tvdbId" integer,
        "imdbId" varchar,
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "mediaAddedAt" datetime,
        "serviceId" integer,
        "serviceId4k" integer,
        "externalServiceId" integer,
        "externalServiceId4k" integer,
        "externalServiceSlug" varchar,
        "externalServiceSlug4k" varchar,
        "ratingKey" varchar,
        "ratingKey4k" varchar,
        "jellyfinMediaId" varchar,
        "jellyfinMediaId4k" varchar
      )`
    );

    await queryRunner.query(
      `INSERT INTO "temporary_media"
      SELECT * FROM "media" WHERE "mediaType" != 'music'`
    );

    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);

    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId")`
    );
  }
}
