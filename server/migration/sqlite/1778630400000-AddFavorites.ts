import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavorites1778630400000 implements MigrationInterface {
  name = 'AddFavorites1778630400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar NOT NULL, "tmdbId" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "requestedById" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE, "mediaId" integer REFERENCES "media"("id") ON DELETE CASCADE, CONSTRAINT "UNIQUE_USER_FAVORITES" UNIQUE ("tmdbId", "mediaType", "requestedById"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1a651dff5f1fb8897932a0fdd" ON "favorites" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bdf703a5ef89d5d99ca96b2418" ON "favorites" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_529e180fcf8eafd7218fe340c5" ON "favorites" ("mediaId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_529e180fcf8eafd7218fe340c5"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_bdf703a5ef89d5d99ca96b2418"`
    );
    await queryRunner.query(
      `DROP INDEX "IDX_e1a651dff5f1fb8897932a0fdd"`
    );
    await queryRunner.query(`DROP TABLE "favorites"`);
  }
}
