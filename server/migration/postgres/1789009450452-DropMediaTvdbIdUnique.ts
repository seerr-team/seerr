import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropMediaTvdbIdUnique1789009450452 implements MigrationInterface {
  name = 'DropMediaTvdbIdUnique1789009450452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "UQ_41a289eb1fa489c1bc6f38d9c3c" UNIQUE ("tvdbId")`
    );
  }
}
