import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginToken1773570292337 implements MigrationInterface {
  name = 'AddLoginToken1773570292337';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "loginToken" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "loginToken"`);
  }
}
