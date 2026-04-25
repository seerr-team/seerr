import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeTable1771451593380 implements MigrationInterface {
  name = 'AddEpisodeTable1771451593380';

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
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer)`
    );
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
    await queryRunner.query(
      `CREATE TABLE "temporary_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_episode"("id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId") SELECT "id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId" FROM "episode"`
    );
    await queryRunner.query(`DROP TABLE "episode"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_episode" RENAME TO "episode"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" RENAME TO "temporary_episode"`
    );
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer)`
    );
    await queryRunner.query(
      `INSERT INTO "episode"("id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId") SELECT "id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId" FROM "temporary_episode"`
    );
    await queryRunner.query(`DROP TABLE "temporary_episode"`);
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
    await queryRunner.query(`DROP TABLE "episode"`);
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
