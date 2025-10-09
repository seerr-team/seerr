import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIgnoreQuotaToMediaRequest1760028688313
  implements MigrationInterface
{
  name = 'AddIgnoreQuotaToMediaRequest1760028688313';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "type" varchar NOT NULL, "mediaId" integer, "requestedBy" integer, "modifiedBy" integer, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), "ignoreQuota" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_media_request_media" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_media_request_user" FOREIGN KEY ("requestedBy") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_media_request_user_2" FOREIGN KEY ("modifiedBy") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedBy", "modifiedBy", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedBy", "modifiedBy", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "type" varchar NOT NULL, "mediaId" integer, "requestedBy" integer, "modifiedBy" integer, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_media_request_media" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_media_request_user" FOREIGN KEY ("requestedBy") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_media_request_user_2" FOREIGN KEY ("modifiedBy") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedBy", "modifiedBy", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedBy", "modifiedBy", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
  }
}
