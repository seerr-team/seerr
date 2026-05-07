import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeTable1778186287181 implements MigrationInterface {
  name = 'AddEpisodeTable1778186287181';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" SERIAL NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT '1', "status4k" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "seasonId" integer, CONSTRAINT "PK_7258b95d6d2bf7f621845a0e143" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e73d28c1e5e3c85125163f7c9c" ON "episode" ("seasonId") `
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" DROP CONSTRAINT "FK_e73d28c1e5e3c85125163f7c9cd"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e73d28c1e5e3c85125163f7c9c"`
    );
    await queryRunner.query(`DROP TABLE "episode"`);
  }
}
