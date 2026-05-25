import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavorites1778630400000 implements MigrationInterface {
  name = 'AddFavorites1778630400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "favorites" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL, "title" character varying NOT NULL, "tmdbId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "requestedById" integer, "mediaId" integer, CONSTRAINT "UNIQUE_USER_FAVORITES" UNIQUE ("tmdbId", "mediaType", "requestedById"), CONSTRAINT "PK_favorites" PRIMARY KEY ("id"))`
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
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_favorites_requestedBy" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_favorites_media" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_favorites_media"`
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_favorites_requestedBy"`
    );
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
