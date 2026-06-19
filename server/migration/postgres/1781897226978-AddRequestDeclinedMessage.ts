import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestDeclinedMessage1781897226978 implements MigrationInterface {
  name = 'AddRequestDeclinedMessage1781897226978';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "watchlist" ("id" SERIAL NOT NULL, "ratingKey" character varying NOT NULL, "mediaType" character varying NOT NULL, "title" character varying NOT NULL, "tmdbId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("tmdbId", "mediaType", "requestedById"), CONSTRAINT "PK_0c8c0dbcc8d379117138e71ad5b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_939f205946256cc0d2a1ac51a8" ON "watchlist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae34e6b153a90672eb9dc4857d" ON "watchlist" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6641da8d831b93dfcb429f8b8b" ON "watchlist" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE TABLE "issue_comment" ("id" SERIAL NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer, "issueId" integer, CONSTRAINT "PK_2ad05784e2ae661fa409e5e0248" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_707b033c2d0653f75213614789" ON "issue_comment" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_180710fead1c94ca499c57a7d4" ON "issue_comment" ("issueId") `
    );
    await queryRunner.query(
      `CREATE TABLE "issue" ("id" SERIAL NOT NULL, "issueType" integer NOT NULL, "status" integer NOT NULL DEFAULT '1', "problemSeason" integer NOT NULL DEFAULT '0', "problemEpisode" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaId" integer, "createdById" integer, "modifiedById" integer, CONSTRAINT "PK_f80e086c249b9f3f3ff2fd321b7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53d04c07c3f4f54eae372ed665" ON "issue" ("issueType") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_276e20d053f3cff1645803c95d" ON "issue" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_10b17b49d1ee77e7184216001e" ON "issue" ("createdById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da88a1019c850d1a7b143ca02e" ON "issue" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE TABLE "override_rule" ("id" SERIAL NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "users" character varying, "genre" character varying, "language" character varying, "keywords" character varying, "profileId" integer, "rootFolder" character varying, "tags" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_657f810c7b20a4fce45aee8f182" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "season_request" ("id" SERIAL NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestId" integer, CONSTRAINT "PK_4811e502081543bf620f1fa4328" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f14737e346d6b27d8e50d2157" ON "season_request" ("requestId") `
    );
    await queryRunner.query(
      `CREATE TABLE "media_request" ("id" SERIAL NOT NULL, "status" integer NOT NULL, "declineReason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying NOT NULL, "is4k" boolean NOT NULL DEFAULT false, "serverId" integer, "profileId" integer, "rootFolder" character varying, "languageProfileId" integer, "tags" text, "isAutoRequest" boolean NOT NULL DEFAULT false, "ignoreQuota" boolean NOT NULL DEFAULT false, "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "PK_f8334500e8e12db87536558c66c" PRIMARY KEY ("id"))`
    );
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
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" SERIAL NOT NULL, "endpoint" character varying NOT NULL, "p256dh" character varying NOT NULL, "auth" character varying NOT NULL, "userAgent" character varying, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(), "userId" integer, CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "PK_397020e7be9a4086cc798e0bb63" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" SERIAL NOT NULL, "locale" character varying NOT NULL DEFAULT '', "discoverRegion" character varying, "streamingRegion" character varying, "originalLanguage" character varying, "pgpKey" character varying, "discordIds" text, "pushbulletAccessToken" character varying, "pushoverApplicationToken" character varying, "pushoverUserKey" character varying, "pushoverSound" character varying, "telegramChatId" character varying, "telegramMessageThreadId" character varying, "telegramSendSilently" boolean, "watchlistSyncMovies" boolean, "watchlistSyncTv" boolean, "notificationTypes" text, "userId" integer, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"), CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "plexUsername" character varying, "jellyfinUsername" character varying, "username" character varying, "password" character varying, "resetPasswordGuid" character varying, "recoveryLinkExpirationDate" TIMESTAMP WITH TIME ZONE, "userType" integer NOT NULL DEFAULT '1', "plexId" integer, "jellyfinUserId" character varying, "jellyfinDeviceId" character varying, "jellyfinAuthToken" character varying, "plexToken" character varying, "permissions" integer NOT NULL DEFAULT '0', "avatar" character varying NOT NULL, "avatarETag" character varying, "avatarVersion" character varying, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL, "title" character varying, "tmdbId" integer NOT NULL, "blocklistedTags" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer, "mediaId" integer, CONSTRAINT "UQ_81504e02db89b4c1e3152729fa6" UNIQUE ("tmdbId", "mediaType"), CONSTRAINT "REL_5c8af2d0e83b3be6d250eccc19" UNIQUE ("mediaId"), CONSTRAINT "PK_c3a1a2ea2ffda610496ce852572" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE TABLE "season" ("id" SERIAL NOT NULL, "seasonNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT '1', "status4k" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaId" integer, CONSTRAINT "PK_8ac0d081dbdb7ab02d166bcda9f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_087099b39600be695591da9a49" ON "season" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE TABLE "media" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL, "tmdbId" integer NOT NULL, "tvdbId" integer, "imdbId" character varying, "status" integer NOT NULL DEFAULT '1', "status4k" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastSeasonChange" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaAddedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(), "serviceId" integer, "serviceId4k" integer, "externalServiceId" integer, "externalServiceId4k" integer, "externalServiceSlug" character varying, "externalServiceSlug4k" character varying, "ratingKey" character varying, "ratingKey4k" character varying, "jellyfinMediaId" character varying, "jellyfinMediaId4k" character varying, CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId"), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`
    );
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
      `CREATE INDEX "IDX_c730c2d67f271a372c39a07b7e" ON "media" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d6218de4f547909391a5c1347" ON "media" ("status4k") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8233358694d1677a67899b90a" ON "media" ("tmdbId", "mediaType") `
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("expiredAt" bigint NOT NULL, "id" character varying(255) NOT NULL, "json" text NOT NULL, "destroyedAt" TIMESTAMP, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28c5d1d16da7908c97c9bc2f74" ON "session" ("expiredAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "discover_slider" ("id" SERIAL NOT NULL, "type" integer NOT NULL, "order" integer NOT NULL, "isBuiltIn" boolean NOT NULL DEFAULT false, "enabled" boolean NOT NULL DEFAULT true, "title" character varying, "data" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_20a71a098d04bae448e4d51db23" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_ae34e6b153a90672eb9dc4857d7" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "issue_comment" ADD CONSTRAINT "FK_707b033c2d0653f75213614789d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "issue_comment" ADD CONSTRAINT "FK_180710fead1c94ca499c57a7d42" FOREIGN KEY ("issueId") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" ADD CONSTRAINT "FK_276e20d053f3cff1645803c95d8" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" ADD CONSTRAINT "FK_10b17b49d1ee77e7184216001e0" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" ADD CONSTRAINT "FK_da88a1019c850d1a7b143ca02e5" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "season_request" ADD CONSTRAINT "FK_6f14737e346d6b27d8e50d2157a" FOREIGN KEY ("requestId") REFERENCES "media_request"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_6997bee94720f1ecb7f31137095" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" ADD CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "season" ADD CONSTRAINT "FK_087099b39600be695591da9a49c" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "season" DROP CONSTRAINT "FK_087099b39600be695591da9a49c"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_356721a49f145aa439c16e6b999"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" DROP CONSTRAINT "FK_03f7958328e311761b0de675fbe"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_f4fc4efa14c3ba2b29c4525fa15"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_6997bee94720f1ecb7f31137095"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP CONSTRAINT "FK_a1aa713f41c99e9d10c48da75a0"`
    );
    await queryRunner.query(
      `ALTER TABLE "season_request" DROP CONSTRAINT "FK_6f14737e346d6b27d8e50d2157a"`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" DROP CONSTRAINT "FK_da88a1019c850d1a7b143ca02e5"`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" DROP CONSTRAINT "FK_10b17b49d1ee77e7184216001e0"`
    );
    await queryRunner.query(
      `ALTER TABLE "issue" DROP CONSTRAINT "FK_276e20d053f3cff1645803c95d8"`
    );
    await queryRunner.query(
      `ALTER TABLE "issue_comment" DROP CONSTRAINT "FK_180710fead1c94ca499c57a7d42"`
    );
    await queryRunner.query(
      `ALTER TABLE "issue_comment" DROP CONSTRAINT "FK_707b033c2d0653f75213614789d"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_ae34e6b153a90672eb9dc4857d7"`
    );
    await queryRunner.query(`DROP TABLE "discover_slider"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28c5d1d16da7908c97c9bc2f74"`
    );
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8233358694d1677a67899b90a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5d6218de4f547909391a5c1347"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c730c2d67f271a372c39a07b7e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ff2d11f6a83cb52386eaebe74"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41a289eb1fa489c1bc6f38d9c3"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7157aad07c73f6a6ae3bbd5ef5"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_087099b39600be695591da9a49"`
    );
    await queryRunner.query(`DROP TABLE "season"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_356721a49f145aa439c16e6b99"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09b94c932e84635c5461f3c0a9"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03f7958328e311761b0de675fb"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f4fc4efa14c3ba2b29c4525fa1"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6997bee94720f1ecb7f3113709"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a1aa713f41c99e9d10c48da75a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4c696e8ed36ae34fe18abe59d2"`
    );
    await queryRunner.query(`DROP TABLE "media_request"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f14737e346d6b27d8e50d2157"`
    );
    await queryRunner.query(`DROP TABLE "season_request"`);
    await queryRunner.query(`DROP TABLE "override_rule"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da88a1019c850d1a7b143ca02e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_10b17b49d1ee77e7184216001e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_276e20d053f3cff1645803c95d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53d04c07c3f4f54eae372ed665"`
    );
    await queryRunner.query(`DROP TABLE "issue"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_180710fead1c94ca499c57a7d4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_707b033c2d0653f75213614789"`
    );
    await queryRunner.query(`DROP TABLE "issue_comment"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6641da8d831b93dfcb429f8b8b"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae34e6b153a90672eb9dc4857d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_939f205946256cc0d2a1ac51a8"`
    );
    await queryRunner.query(`DROP TABLE "watchlist"`);
  }
}
