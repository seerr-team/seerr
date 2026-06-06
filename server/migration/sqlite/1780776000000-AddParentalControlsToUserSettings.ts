import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentalControlsToUserSettings1780776000000 implements MigrationInterface {
  name = 'AddParentalControlsToUserSettings1780776000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "parentalControlsEnabled" boolean NOT NULL DEFAULT (0)`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxMovieCertification" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "maxTvCertification" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "parentalControlsRegion" varchar NOT NULL DEFAULT ('US')`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "blockUnrated" boolean NOT NULL DEFAULT (0)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_user_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "locale" varchar NOT NULL DEFAULT (''), "discoverRegion" varchar, "streamingRegion" varchar, "originalLanguage" varchar, "pgpKey" varchar, "discordIds" text, "pushbulletAccessToken" varchar, "pushoverApplicationToken" varchar, "pushoverUserKey" varchar, "pushoverSound" varchar, "telegramChatId" varchar, "telegramSendSilently" boolean, "watchlistSyncMovies" boolean, "watchlistSyncTv" boolean, "notificationTypes" text, "userId" integer, "telegramMessageThreadId" varchar, CONSTRAINT "REL_986a2b6d3c05eb4091bb8066f7" UNIQUE ("userId"), CONSTRAINT "FK_986a2b6d3c05eb4091bb8066f78" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_settings"("id", "locale", "discoverRegion", "streamingRegion", "originalLanguage", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramSendSilently", "watchlistSyncMovies", "watchlistSyncTv", "notificationTypes", "userId", "telegramMessageThreadId") SELECT "id", "locale", "discoverRegion", "streamingRegion", "originalLanguage", "pgpKey", "discordIds", "pushbulletAccessToken", "pushoverApplicationToken", "pushoverUserKey", "pushoverSound", "telegramChatId", "telegramSendSilently", "watchlistSyncMovies", "watchlistSyncTv", "notificationTypes", "userId", "telegramMessageThreadId" FROM "user_settings"`
    );
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_settings" RENAME TO "user_settings"`
    );
  }
}
