import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMusicSupport1762648503371 implements MigrationInterface {
  name = 'AddMusicSupport1762648503371';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "metadata_album" ("id" SERIAL NOT NULL, "mbAlbumId" character varying NOT NULL, "caaUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fb8eda254e560f96039f7a0d812" UNIQUE ("mbAlbumId"), CONSTRAINT "PK_02aaaa276bcc3de3ead4bd2b8f3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "metadata_artist" ("id" SERIAL NOT NULL, "mbArtistId" character varying NOT NULL, "tmdbPersonId" character varying, "tmdbThumb" character varying, "tmdbUpdatedAt" TIMESTAMP WITH TIME ZONE, "tadbThumb" character varying, "tadbCover" character varying, "tadbUpdatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bff8b9448b4a8a3af0f8957d4b7" UNIQUE ("mbArtistId"), CONSTRAINT "PK_06d683fc350297c5aef7f0fe5c4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD "mbId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "override_rule" ADD "lidarrServiceId" integer`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaLimit" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaDays" integer`);
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD "mbId" character varying`
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "mbId" character varying`);
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "UNIQUE_USER_DB"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "mediaId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP CONSTRAINT "UQ_6bbafa28411e6046421991ea21c"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "serviceId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "serviceId" SET DEFAULT '0'`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a40b88a30fc50cf10264e279c9" ON "watchlist" ("mbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f7c7041c1792b568be902f097" ON "blacklist" ("mbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c866e76dd595ad15b8c5bf9c1" ON "media" ("mbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "UNIQUE_USER_FOREIGN" UNIQUE ("mbId", "requestedById")`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("tmdbId", "requestedById")`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD CONSTRAINT "UQ_30a2423945ffaeb135b518d074d" UNIQUE ("tmdbId", "mbId")`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" DROP CONSTRAINT "UQ_30a2423945ffaeb135b518d074d"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "UNIQUE_USER_DB"`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT "UNIQUE_USER_FOREIGN"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6c866e76dd595ad15b8c5bf9c1"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f7c7041c1792b568be902f097"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a40b88a30fc50cf10264e279c9"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "serviceId" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "serviceId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ADD CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId")`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist" ALTER COLUMN "tmdbId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "mediaId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "tmdbId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("tmdbId", "requestedById")`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "FK_6641da8d831b93dfcb429f8b8bc" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mbId"`);
    await queryRunner.query(`ALTER TABLE "blacklist" DROP COLUMN "mbId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaDays"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaLimit"`);
    await queryRunner.query(
      `ALTER TABLE "override_rule" DROP COLUMN "lidarrServiceId"`
    );
    await queryRunner.query(`ALTER TABLE "watchlist" DROP COLUMN "mbId"`);
    await queryRunner.query(`DROP TABLE "metadata_artist"`);
    await queryRunner.query(`DROP TABLE "metadata_album"`);
  }
}
