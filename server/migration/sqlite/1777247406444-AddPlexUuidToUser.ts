import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexUuidToUser1777247406444 implements MigrationInterface {
  name = 'AddPlexUuidToUser1777247406444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" datetime, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "jellyfinUsername" varchar, "jellyfinAuthToken" varchar, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "avatarETag" varchar, "avatarVersion" varchar, "plexUuid" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_81504e02db89b4c1e3152729fa6" UNIQUE ("tmdbId", "mediaType"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" datetime, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "jellyfinUsername" varchar, "jellyfinAuthToken" varchar, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "avatarETag" varchar, "avatarVersion" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(`DROP INDEX "IDX_356721a49f145aa439c16e6b99"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_03f7958328e311761b0de675fb"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
  }
}
