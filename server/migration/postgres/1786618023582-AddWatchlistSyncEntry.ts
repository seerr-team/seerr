import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWatchlistSyncEntry1786618023582 implements MigrationInterface {
  name = 'AddWatchlistSyncEntry1786618023582';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry_season" ("id" SERIAL NOT NULL, "seasonNumber" integer NOT NULL, "entryId" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY_SEASON" UNIQUE ("entryId", "seasonNumber"), CONSTRAINT "PK_2dc191c81c33714bf0c82c8adc2" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9d29444df017aa0cbfa5a2244" ON "watchlist_sync_entry_season" ("entryId") `
    );
    await queryRunner.query(
      `CREATE TABLE "watchlist_sync_entry" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "watchlistedAt" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestedById" integer NOT NULL, CONSTRAINT "UNIQUE_WATCHLIST_SYNC_ENTRY" UNIQUE ("requestedById", "tmdbId", "mediaType"), CONSTRAINT "PK_9f6976e1fc5d9d4266060c7d66c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76036f4009dac0f28dd3913012" ON "watchlist_sync_entry" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_acad2425a838db492a20431e32" ON "watchlist_sync_entry" ("requestedById") `
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry_season" ADD CONSTRAINT "FK_d9d29444df017aa0cbfa5a2244d" FOREIGN KEY ("entryId") REFERENCES "watchlist_sync_entry"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry" ADD CONSTRAINT "FK_acad2425a838db492a20431e327" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry" DROP CONSTRAINT "FK_acad2425a838db492a20431e327"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist_sync_entry_season" DROP CONSTRAINT "FK_d9d29444df017aa0cbfa5a2244d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_acad2425a838db492a20431e32"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_76036f4009dac0f28dd3913012"`
    );
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d9d29444df017aa0cbfa5a2244"`
    );
    await queryRunner.query(`DROP TABLE "watchlist_sync_entry_season"`);
  }
}
