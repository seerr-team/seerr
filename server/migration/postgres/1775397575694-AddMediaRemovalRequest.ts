import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaRemovalRequest1775397575694 implements MigrationInterface {
  name = 'AddMediaRemovalRequest1775397575694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_removal_request" ("id" SERIAL NOT NULL, "status" integer NOT NULL, "is4k" boolean NOT NULL DEFAULT false, "seasons" text, "reason" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mediaId" integer, "requestedById" integer, "modifiedById" integer, CONSTRAINT "PK_2e934c02b7a727d262b9c0adc36" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_64e0da8892d7f8aabce7198097" ON "media_removal_request" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_78decd4e1901d80cfdce43b079" ON "media_removal_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_148182cef7f27b27b1fdacd7de" ON "media_removal_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34c6963994828cb30c9b2798df" ON "media_removal_request" ("modifiedById") `
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "permissions" TYPE bigint`
    );
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" ADD CONSTRAINT "FK_78decd4e1901d80cfdce43b079f" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" ADD CONSTRAINT "FK_148182cef7f27b27b1fdacd7de1" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" ADD CONSTRAINT "FK_34c6963994828cb30c9b2798dfa" FOREIGN KEY ("modifiedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" DROP CONSTRAINT "FK_34c6963994828cb30c9b2798dfa"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" DROP CONSTRAINT "FK_148182cef7f27b27b1fdacd7de1"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_removal_request" DROP CONSTRAINT "FK_78decd4e1901d80cfdce43b079f"`
    );
    await queryRunner.query(
      `UPDATE "user" SET "permissions" = "permissions" & 2147483647 WHERE "permissions" > 2147483647`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "permissions" TYPE integer`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_34c6963994828cb30c9b2798df"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_148182cef7f27b27b1fdacd7de"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_78decd4e1901d80cfdce43b079"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_64e0da8892d7f8aabce7198097"`
    );
    await queryRunner.query(`DROP TABLE "media_removal_request"`);
  }
}
