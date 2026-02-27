import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoting1772153885378 implements MigrationInterface {
  name = 'AddVoting1772153885378';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "vote" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "actionType" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, CONSTRAINT "UQ_c0f8905b5d8f510f95e41f4a6da" UNIQUE ("userId", "tmdbId", "mediaType"), CONSTRAINT "PK_121b3b79fce9d8f4f4859b0f5f8" PRIMARY KEY ("id"))`
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
    await queryRunner.query(
      `ALTER TABLE "vote" ADD CONSTRAINT "FK_4d7f0d2d4f5ee1739a637ec5a5a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vote" DROP CONSTRAINT "FK_4d7f0d2d4f5ee1739a637ec5a5a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_33f4c9ebf3ad06ec3156fbe5f4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6e84ec1f1d89da477fd3de362d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4d7f0d2d4f5ee1739a637ec5a5"`
    );
    await queryRunner.query(`DROP TABLE "vote"`);
  }
}
