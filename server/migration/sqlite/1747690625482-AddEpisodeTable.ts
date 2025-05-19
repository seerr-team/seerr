import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeTable1747690625482 implements MigrationInterface {
  name = 'AddEpisodeTable1747690625482';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer)`
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
  }
}
