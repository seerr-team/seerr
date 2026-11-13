import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWatchlistSyncEntry1786620022403 implements MigrationInterface {
  name = 'AddWatchlistSyncEntry1786620022403';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "watchlistedAt" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY" UNIQUE ("requestedById", "tmdbId", "mediaType"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76036f4009dac0f28dd3913012" ON "watchlist_sync_entry" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acad2425a838db492a20431e32" ON "watchlist_sync_entry" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry_season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "entryId" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY_SEASON" UNIQUE ("entryId", "seasonNumber"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9d29444df017aa0cbfa5a2244" ON "watchlist_sync_entry_season" ("entryId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_76036f4009dac0f28dd3913012"`);
    await queryRunner.query(`DROP INDEX "IDX_acad2425a838db492a20431e32"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_watchlist_sync_entry" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "watchlistedAt" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY" UNIQUE ("requestedById", "tmdbId", "mediaType"), CONSTRAINT "FK_acad2425a838db492a20431e327" FOREIGN KEY ("requestedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_watchlist_sync_entry"("id", "tmdbId", "mediaType", "watchlistedAt", "createdAt", "updatedAt", "requestedById") SELECT "id", "tmdbId", "mediaType", "watchlistedAt", "createdAt", "updatedAt", "requestedById" FROM "watchlist_sync_entry"`
    );
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_watchlist_sync_entry" RENAME TO "watchlist_sync_entry"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76036f4009dac0f28dd3913012" ON "watchlist_sync_entry" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acad2425a838db492a20431e32" ON "watchlist_sync_entry" ("requestedById") `
    );
    await queryRunner.query(`DROP INDEX "IDX_d9d29444df017aa0cbfa5a2244"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_watchlist_sync_entry_season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "entryId" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY_SEASON" UNIQUE ("entryId", "seasonNumber"), CONSTRAINT "FK_d9d29444df017aa0cbfa5a2244d" FOREIGN KEY ("entryId") REFERENCES "watchlist_sync_entry" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_watchlist_sync_entry_season"("id", "seasonNumber", "entryId") SELECT "id", "seasonNumber", "entryId" FROM "watchlist_sync_entry_season"`
    );
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry_season"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_watchlist_sync_entry_season" RENAME TO "watchlist_sync_entry_season"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9d29444df017aa0cbfa5a2244" ON "watchlist_sync_entry_season" ("entryId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_d9d29444df017aa0cbfa5a2244"`);
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry_season" RENAME TO "temporary_watchlist_sync_entry_season"`
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry_season" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "entryId" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY_SEASON" UNIQUE ("entryId", "seasonNumber"))`
    );
    await queryRunner.query(
      `INSERT INTO "watchlist_sync_entry_season"("id", "seasonNumber", "entryId") SELECT "id", "seasonNumber", "entryId" FROM "temporary_watchlist_sync_entry_season"`
    );
    await queryRunner.query(
      `DROP TABLE "temporary_watchlist_sync_entry_season"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9d29444df017aa0cbfa5a2244" ON "watchlist_sync_entry_season" ("entryId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_acad2425a838db492a20431e32"`);
    await queryRunner.query(`DROP INDEX "IDX_76036f4009dac0f28dd3913012"`);
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry" RENAME TO "temporary_watchlist_sync_entry"`
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "watchlistedAt" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "requestedById" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY" UNIQUE ("requestedById", "tmdbId", "mediaType"))`
    );
    await queryRunner.query(
      `INSERT INTO "watchlist_sync_entry"("id", "tmdbId", "mediaType", "watchlistedAt", "createdAt", "updatedAt", "requestedById") SELECT "id", "tmdbId", "mediaType", "watchlistedAt", "createdAt", "updatedAt", "requestedById" FROM "temporary_watchlist_sync_entry"`
    );
    await queryRunner.query(`DROP TABLE "temporary_watchlist_sync_entry"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_acad2425a838db492a20431e32" ON "watchlist_sync_entry" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76036f4009dac0f28dd3913012" ON "watchlist_sync_entry" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_d9d29444df017aa0cbfa5a2244"`);
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry_season"`);
    await queryRunner.query(`DROP INDEX "IDX_acad2425a838db492a20431e32"`);
    await queryRunner.query(`DROP INDEX "IDX_76036f4009dac0f28dd3913012"`);
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry"`);
  }
}
