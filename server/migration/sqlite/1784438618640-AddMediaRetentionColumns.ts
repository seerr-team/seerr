import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaRetentionColumns1784438618640 implements MigrationInterface {
  name = 'AddMediaRetentionColumns1784438618640';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, "retentionDays" integer, "availableSince" datetime, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1" ON "media_request" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6997bee94720f1ecb7f3113709" ON "media_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1aa713f41c99e9d10c48da75a" ON "media_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4c696e8ed36ae34fe18abe59d2" ON "media_request" ("status") `
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "plexUsername" varchar, "jellyfinUsername" varchar, "username" varchar, "password" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" datetime, "userType" integer NOT NULL DEFAULT (1), "plexId" integer, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "jellyfinAuthToken" varchar, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "avatarETag" varchar, "avatarVersion" varchar, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "movieRetentionDays" integer, "tvRetentionDays" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt") SELECT "id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "plexUsername" varchar, "jellyfinUsername" varchar, "username" varchar, "password" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" datetime, "userType" integer NOT NULL DEFAULT (1), "plexId" integer, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "jellyfinAuthToken" varchar, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "avatarETag" varchar, "avatarVersion" varchar, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt") SELECT "id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
    await queryRunner.query(`DROP INDEX "IDX_4c696e8ed36ae34fe18abe59d2"`);
    await queryRunner.query(`DROP INDEX "IDX_a1aa713f41c99e9d10c48da75a"`);
    await queryRunner.query(`DROP INDEX "IDX_6997bee94720f1ecb7f3113709"`);
    await queryRunner.query(`DROP INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), "ignoreQuota" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "ignoreQuota", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "ignoreQuota", "mediaId", "requestedById", "modifiedById" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_4c696e8ed36ae34fe18abe59d2" ON "media_request" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1aa713f41c99e9d10c48da75a" ON "media_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6997bee94720f1ecb7f3113709" ON "media_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1" ON "media_request" ("modifiedById") `
    );
  }
}
