import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForeignKeyIndexes1771259406751 implements MigrationInterface {
  name = 'AddForeignKeyIndexes1771259406751';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bbafa28411e6046421991ea21"`
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "blocklist_id_seq" OWNED BY "blocklist"."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('"blocklist_id_seq"')`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae34e6b153a90672eb9dc4857d" ON "watchlist" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6641da8d831b93dfcb429f8b8b" ON "watchlist" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_707b033c2d0653f75213614789" ON "issue_comment" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_180710fead1c94ca499c57a7d4" ON "issue_comment" ("issueId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53d04c07c3f4f54eae372ed665" ON "issue" ("issueType") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_276e20d053f3cff1645803c95d" ON "issue" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_10b17b49d1ee77e7184216001e" ON "issue" ("createdById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da88a1019c850d1a7b143ca02e" ON "issue" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f14737e346d6b27d8e50d2157" ON "season_request" ("requestId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1aa713f41c99e9d10c48da75a" ON "media_request" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6997bee94720f1ecb7f3113709" ON "media_request" ("requestedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4fc4efa14c3ba2b29c4525fa1" ON "media_request" ("modifiedById") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_03f7958328e311761b0de675fb" ON "user_push_subscription" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_356721a49f145aa439c16e6b99" ON "blocklist" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_087099b39600be695591da9a49" ON "season" ("mediaId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_356721a49f145aa439c16e6b999"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_087099b39600be695591da9a49"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_356721a49f145aa439c16e6b99"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09b94c932e84635c5461f3c0a9"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_03f7958328e311761b0de675fb"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f4fc4efa14c3ba2b29c4525fa1"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6997bee94720f1ecb7f3113709"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a1aa713f41c99e9d10c48da75a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6f14737e346d6b27d8e50d2157"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da88a1019c850d1a7b143ca02e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_10b17b49d1ee77e7184216001e"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_276e20d053f3cff1645803c95d"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53d04c07c3f4f54eae372ed665"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_180710fead1c94ca499c57a7d4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_707b033c2d0653f75213614789"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6641da8d831b93dfcb429f8b8b"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae34e6b153a90672eb9dc4857d"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('blacklist_id_seq')`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`DROP SEQUENCE "blocklist_id_seq"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
