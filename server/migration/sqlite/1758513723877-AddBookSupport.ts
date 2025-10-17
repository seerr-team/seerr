import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookSupport1758513723877 implements MigrationInterface {
  name = 'AddBookSupport1758513723877';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_6bbafa28411e6046421991ea21"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "externalId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blacklist"("id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "blacklist"`
    );
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blacklist" RENAME TO "blacklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "mediaId" integer, "requestedById" integer, "modifiedById" integer, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" varchar, "externalServiceSlug4k" varchar, "ratingKey" varchar, "ratingKey4k" varchar, "jellyfinMediaId" varchar, "jellyfinMediaId4k" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_override_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "users" varchar, "genre" varchar, "language" varchar, "keywords" varchar, "profileId" integer, "rootFolder" varchar, "tags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "readarrServiceId" integer, "metadataProfileId" integer)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_override_rule"("id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt") SELECT "id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt" FROM "override_rule"`
    );
    await queryRunner.query(`DROP TABLE "override_rule"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_override_rule" RENAME TO "override_rule"`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "mediaId" integer, "requestedById" integer, "modifiedById" integer, "isAlt" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "metadataProfileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "isAlt", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "media_request"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_request" RENAME TO "media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "plexUsername" varchar, "jellyfinUsername" varchar, "username" varchar, "password" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" date, "userType" integer NOT NULL DEFAULT (1), "plexId" integer, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "jellyfinAuthToken" varchar, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "avatarETag" varchar, "avatarVersion" varchar, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "bookQuotaLimit" integer, "bookQuotaDays" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt") SELECT "id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "hcId" integer, "status" integer NOT NULL DEFAULT (1), "statusAlt" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceIdAlt" integer, "externalServiceId" integer, "externalServiceIdAlt" integer, "externalServiceSlug" varchar, "externalServiceSlugAlt" varchar, "ratingKey" varchar, "ratingKeyAlt" varchar, "jellyfinMediaId" varchar, "jellyfinMediaIdAlt" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "externalId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blacklist"("id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "blacklist"`
    );
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blacklist" RENAME TO "blacklist"`
    );
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer, "tvdbId" integer, "imdbId" varchar, "hcId" integer, "status" integer NOT NULL DEFAULT (1), "statusAlt" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceIdAlt" integer, "externalServiceId" integer, "externalServiceIdAlt" integer, "externalServiceSlug" varchar, "externalServiceSlugAlt" varchar, "ratingKey" varchar, "ratingKeyAlt" varchar, "jellyfinMediaId" varchar, "jellyfinMediaIdAlt" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "externalServiceId", "externalServiceSlug", "ratingKey", "jellyfinMediaId", "serviceIdAlt", "externalServiceIdAlt", "externalServiceSlugAlt", "ratingKeyAlt", "jellyfinMediaIdAlt") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e460d2f12505b0d9adf2a8014a" ON "blacklist" ("externalId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f926a3b825cc8d5b982f726367" ON "media" ("hcId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_e460d2f12505b0d9adf2a8014a"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "externalId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId"), CONSTRAINT "UQ_cd389742b9156ca10495f21fe0a" UNIQUE ("externalId", "mediaType"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blacklist"("id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "blacklist"`
    );
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blacklist" RENAME TO "blacklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e460d2f12505b0d9adf2a8014a" ON "blacklist" ("externalId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_e460d2f12505b0d9adf2a8014a"`);
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME TO "temporary_blacklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "externalId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blacklist"("id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blacklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blacklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_e460d2f12505b0d9adf2a8014a" ON "blacklist" ("externalId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_f926a3b825cc8d5b982f726367"`);
    await queryRunner.query(`DROP INDEX "IDX_e460d2f12505b0d9adf2a8014a"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "hcId" integer, "status" integer NOT NULL DEFAULT (1), "statusAlt" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceIdAlt" integer, "externalServiceId" integer, "externalServiceIdAlt" integer, "externalServiceSlug" varchar, "externalServiceSlugAlt" varchar, "ratingKey" varchar, "ratingKeyAlt" varchar, "jellyfinMediaId" varchar, "jellyfinMediaIdAlt" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "hcId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME TO "temporary_blacklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "externalId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blacklist"("id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blacklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blacklist"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "status" integer NOT NULL DEFAULT (1), "statusAlt" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceIdAlt" integer, "externalServiceId" integer, "externalServiceIdAlt" integer, "externalServiceSlug" varchar, "externalServiceSlugAlt" varchar, "ratingKey" varchar, "ratingKeyAlt" varchar, "jellyfinMediaId" varchar, "jellyfinMediaIdAlt" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "plexUsername" varchar, "jellyfinUsername" varchar, "username" varchar, "password" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" date, "userType" integer NOT NULL DEFAULT (1), "plexId" integer, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "jellyfinAuthToken" varchar, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "avatarETag" varchar, "avatarVersion" varchar, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt") SELECT "id", "email", "plexUsername", "jellyfinUsername", "username", "password", "resetPasswordGuid", "recoveryLinkExpirationDate", "userType", "plexId", "jellyfinUserId", "jellyfinDeviceId", "jellyfinAuthToken", "plexToken", "permissions", "avatar", "avatarETag", "avatarVersion", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "createdAt", "updatedAt" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "mediaId" integer, "requestedById" integer, "modifiedById" integer, "isAlt" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "isAlt", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest") SELECT "id", "status", "createdAt", "updatedAt", "type", "mediaId", "requestedById", "modifiedById", "isAlt", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
    await queryRunner.query(
      `ALTER TABLE "override_rule" RENAME TO "temporary_override_rule"`
    );
    await queryRunner.query(
      `CREATE TABLE "override_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "users" varchar, "genre" varchar, "language" varchar, "keywords" varchar, "profileId" integer, "rootFolder" varchar, "tags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`
    );
    await queryRunner.query(
      `INSERT INTO "override_rule"("id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt") SELECT "id", "radarrServiceId", "sonarrServiceId", "users", "genre", "language", "keywords", "profileId", "rootFolder", "tags", "createdAt", "updatedAt" FROM "temporary_override_rule"`
    );
    await queryRunner.query(`DROP TABLE "temporary_override_rule"`);
    await queryRunner.query(`DROP INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5"`);
    await queryRunner.query(`DROP INDEX "IDX_41a289eb1fa489c1bc6f38d9c3"`);
    await queryRunner.query(`DROP INDEX "IDX_7ff2d11f6a83cb52386eaebe74"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" varchar, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "lastSeasonChange" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "mediaAddedAt" datetime DEFAULT (CURRENT_TIMESTAMP), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" varchar, "externalServiceSlug4k" varchar, "ratingKey" varchar, "ratingKey4k" varchar, "jellyfinMediaId" varchar, "jellyfinMediaId4k" varchar, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k") SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "statusAlt", "createdAt", "updatedAt", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceIdAlt", "externalServiceId", "externalServiceIdAlt", "externalServiceSlug", "externalServiceSlugAlt", "ratingKey", "ratingKeyAlt", "jellyfinMediaId", "jellyfinMediaIdAlt" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME TO "temporary_media_request"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "status" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "type" varchar NOT NULL, "is4k" boolean NOT NULL DEFAULT (0), "serverId" integer, "profileId" integer, "rootFolder" varchar, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT (0), "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_request"("id", "status", "createdAt", "updatedAt", "type", "is4k", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "mediaId", "requestedById", "modifiedById") SELECT "id", "status", "createdAt", "updatedAt", "type", "isAlt", "serverId", "profileId", "rootFolder", "languageProfileId", "tags", "isAutoRequest", "mediaId", "requestedById", "modifiedById" FROM "temporary_media_request"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_request"`);
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME TO "temporary_blacklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blacklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blacklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blacklist"("id", "mediaType", "title", "tmdbId", "blacklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "externalId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blacklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blacklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blacklist" ("tmdbId") `
    );
  }
}
