import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeUniqueConstraint1772502000000
  implements MigrationInterface
{
  name = 'AddEpisodeUniqueConstraint1772502000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we need to
    // recreate the table with the unique constraint.
    await queryRunner.query(`DROP INDEX "IDX_e73d28c1e5e3c85125163f7c9c"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_episode" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT (1), "status4k" integer NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "seasonId" integer, CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "UQ_episode_season_number" UNIQUE ("seasonId", "episodeNumber"))`
    );
    await queryRunner.query(
      `INSERT OR IGNORE INTO "temporary_episode"("id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId") SELECT "id", "episodeNumber", "status", "status4k", "createdAt", "updatedAt", "seasonId" FROM "episode"`
    );
    await queryRunner.query(`DROP TABLE "episode"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_episode" RENAME TO "episode"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e73d28c1e5e3c85125163f7c9c" ON "episode" ("seasonId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_e73d28c1e5e3c85125163f7c9c"`);
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
    await queryRunner.query(
      `CREATE INDEX "IDX_e73d28c1e5e3c85125163f7c9c" ON "episode" ("seasonId") `
    );
  }
}
