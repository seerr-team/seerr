import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentRatingFilters1736000000000
  implements MigrationInterface
{
  name = 'AddContentRatingFilters1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add maxMovieRating and maxTvRating columns to user_settings
    await queryRunner.query(
      `CREATE TABLE "temporary_user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "notificationTypes" text, "discordId" varchar, "userId" integer, "originalLanguage" varchar, "telegramChatId" varchar, "telegramSendSilently" boolean, "pgpKey" varchar, "locale" varchar NOT NULL DEFAULT (''), "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "watchlistSyncMovies" boolean, "watchlistSyncTv" boolean, "pushoverSound" varchar, "discoverRegion" varchar, "streamingRegion" varchar, "telegramMessageThreadId" varchar, "maxMovieRating" varchar, "maxTvRating" varchar, CONSTRAINT "UQ_986a2b6d3c05eb4091bb8066f78" UNIQUE ("userId"), CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_settings"("id", "notificationTypes", "discordId", "userId", "originalLanguage", "telegramChatId", "telegramSendSilently", "pgpKey", "locale", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "watchlistSyncMovies", "watchlistSyncTv", "pushoverSound", "discoverRegion", "streamingRegion", "telegramMessageThreadId") SELECT "id", "notificationTypes", "discordId", "userId", "originalLanguage", "telegramChatId", "telegramSendSilently", "pgpKey", "locale", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "watchlistSyncMovies", "watchlistSyncTv", "pushoverSound", "discoverRegion", "streamingRegion", "telegramMessageThreadId" FROM "user_settings"`
    );
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_settings" RENAME TO "user_settings"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove maxMovieRating and maxTvRating columns
    await queryRunner.query(
      `ALTER TABLE "user_settings" RENAME TO "temporary_user_settings"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "notificationTypes" text, "discordId" varchar, "userId" integer, "originalLanguage" varchar, "telegramChatId" varchar, "telegramSendSilently" boolean, "pgpKey" varchar, "locale" varchar NOT NULL DEFAULT (''), "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "watchlistSyncMovies" boolean, "watchlistSyncTv" boolean, "pushoverSound" varchar, "discoverRegion" varchar, "streamingRegion" varchar, "telegramMessageThreadId" varchar, CONSTRAINT "UQ_986a2b6d3c05eb4091bb8066f78" UNIQUE ("userId"), CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "user_settings"("id", "notificationTypes", "discordId", "userId", "originalLanguage", "telegramChatId", "telegramSendSilently", "pgpKey", "locale", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "watchlistSyncMovies", "watchlistSyncTv", "pushoverSound", "discoverRegion", "streamingRegion", "telegramMessageThreadId") SELECT "id", "notificationTypes", "discordId", "userId", "originalLanguage", "telegramChatId", "telegramSendSilently", "pgpKey", "locale", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "watchlistSyncMovies", "watchlistSyncTv", "pushoverSound", "discoverRegion", "streamingRegion", "telegramMessageThreadId" FROM "temporary_user_settings"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_settings"`);
  }
}
