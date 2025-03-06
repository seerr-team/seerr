import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMusicSupport1714310036946 implements MigrationInterface {
  name = 'AddMusicSupport1714310036946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaLimit" integer`);
    await queryRunner.query(`ALTER TABLE "user" ADD "musicQuotaDays" integer`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_7ff2d11f6a83cb52386eaebe74"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_41a289eb1fa489c1bc6f38d9c3"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_7157aad07c73f6a6ae3bbd5ef5"`
    );

    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD "mbId" character varying`
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "unique_user_db"`);
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "UNIQUE_USER_DB" UNIQUE ("tmdbId", "requestedById")`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD CONSTRAINT "UNIQUE_USER_FOREIGN" UNIQUE ("mbId", "requestedById")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_watchlist_mbid" ON "watchlist" ("mbId")`
    );

    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" DROP NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "mbId" character varying`);
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_type" CHECK ("mediaType" IN ('movie', 'tv', 'music'))`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_7ff2d11f6a83cb52386eaebe74" ON "media" ("imdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41a289eb1fa489c1bc6f38d9c3" ON "media" ("tvdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7157aad07c73f6a6ae3bbd5ef5" ON "media" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_mbid" ON "media" ("mbId")`
    );

    await queryRunner.query(
      `CREATE TABLE "metadata_album" (
        "id" SERIAL NOT NULL,
        "mbAlbumId" character varying NOT NULL,
        "caaUrl" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_metadata_album" PRIMARY KEY ("id")
      )`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_metadata_album_mbAlbumId" ON "metadata_album" ("mbAlbumId")`
    );

    await queryRunner.query(
      `CREATE TABLE "metadata_artist" (
        "id" SERIAL NOT NULL,
        "mbArtistId" character varying NOT NULL,
        "tmdbPersonId" character varying,
        "tmdbThumb" character varying,
        "tmdbUpdatedAt" TIMESTAMP,
        "tadbThumb" character varying,
        "tadbCover" character varying,
        "tadbUpdatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_metadata_artist" PRIMARY KEY ("id")
      )`
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_metadata_artist_mbArtistId" ON "metadata_artist" ("mbArtistId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_metadata_album_mbAlbumId"`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "metadata_album"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_watchlist_mbid"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_media_mbid"`);

    await queryRunner.query(
      `ALTER TABLE "watchlist" DROP CONSTRAINT IF EXISTS "UNIQUE_USER_FOREIGN"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "CHK_media_type"`
    );

    await queryRunner.query(
      `DELETE FROM "watchlist" WHERE "mediaType" = 'music'`
    );

    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "mbId"`);
    await queryRunner.query(`ALTER TABLE "watchlist" DROP COLUMN "mbId"`);
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "tmdbId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "tmdbId" SET NOT NULL`
    );

    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaDays"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "musicQuotaLimit"`);
  }
}
