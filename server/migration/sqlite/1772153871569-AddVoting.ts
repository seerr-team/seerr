import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoting1772153871569 implements MigrationInterface {
  name = 'AddVoting1772153871569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vote" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "actionType" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer NOT NULL, CONSTRAINT "UQ_c0f8905b5d8f510f95e41f4a6da" UNIQUE ("userId", "tmdbId", "mediaType"), CONSTRAINT "FK_4d7f0d2d4f5ee1739a637ec5a5a" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d7f0d2d4f5ee1739a637ec5a5" ON "vote" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6e84ec1f1d89da477fd3de362d" ON "vote" ("tmdbId", "mediaType") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33f4c9ebf3ad06ec3156fbe5f4" ON "vote" ("userId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_33f4c9ebf3ad06ec3156fbe5f4"`);
    await queryRunner.query(`DROP INDEX "IDX_6e84ec1f1d89da477fd3de362d"`);
    await queryRunner.query(`DROP INDEX "IDX_4d7f0d2d4f5ee1739a637ec5a5"`);
    await queryRunner.query(`DROP TABLE "vote"`);
  }
}
