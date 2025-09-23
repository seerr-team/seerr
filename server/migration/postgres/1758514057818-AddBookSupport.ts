import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookSupport1758514057818 implements MigrationInterface {
  name = 'AddBookSupport1758514057818';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bbafa28411e6046421991ea21"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME COLUMN "tmdbId" TO "externalId"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" TO "UQ_e460d2f12505b0d9adf2a8014af"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME COLUMN "is4k" TO "isAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "status4k" TO "statusAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "serviceId4k" TO "serviceIdAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceId4k" TO "externalServiceIdAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceSlug4k" TO "externalServiceSlugAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "ratingKey4k" TO "ratingKeyAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "jellyfinMediaId4k" TO "jellyfinMediaIdAlt"`
    );
    await queryRunner.query(
      `ALTER TABLE "override_rule" ADD "readarrServiceId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "override_rule" ADD "metadataProfileId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "metadataProfileId" integer`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "bookQuotaLimit" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "bookQuotaDays" integer`);
    await queryRunner.query(`ALTER TABLE "media" ADD "hcId" integer`);
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e460d2f12505b0d9adf2a8014a" ON "blacklist" ("externalId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f926a3b825cc8d5b982f726367" ON "media" ("hcId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD CONSTRAINT "UQ_cd389742b9156ca10495f21fe0a" UNIQUE ("externalId", "mediaType")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP CONSTRAINT "UQ_cd389742b9156ca10495f21fe0a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f926a3b825cc8d5b982f726367"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e460d2f12505b0d9adf2a8014a"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" UNIQUE ("externalId")`
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" RENAME COLUMN "isAlt" TO "is4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "statusAlt" TO "status4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "serviceIdAlt" TO "serviceId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceIdAlt" TO "externalServiceId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "externalServiceSlugAlt" TO "externalServiceSlug4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "ratingKeyAlt" TO "ratingKey4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" RENAME COLUMN "jellyfinMediaIdAlt" TO "jellyfinMediaId4k"`
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "hcId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bookQuotaDays"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "bookQuotaLimit"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "metadataProfileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "override_rule" DROP COLUMN "metadataProfileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "override_rule" DROP COLUMN "readarrServiceId"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME CONSTRAINT "UQ_e460d2f12505b0d9adf2a8014af" TO "UQ_6bbafa28411e6046421991ea21c"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" RENAME COLUMN "externalId" TO "tmdbId"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blacklist" ("tmdbId") `
    );
  }
}
