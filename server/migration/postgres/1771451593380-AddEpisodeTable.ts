import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeTable1771451593380 implements MigrationInterface {
  name = 'AddEpisodeTable1771451593380';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "episode" ("id" SERIAL NOT NULL, "episodeNumber" integer NOT NULL, "status" integer NOT NULL DEFAULT '1', "status4k" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "seasonId" integer, CONSTRAINT "PK_7258b95d6d2bf7f621845a0e143" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "blocklist_id_seq" OWNED BY "blocklist"."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('"blocklist_id_seq"')`
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
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`DROP SEQUENCE "blocklist_id_seq"`);
    await queryRunner.query(`DROP TABLE "episode"`);
  }
}
