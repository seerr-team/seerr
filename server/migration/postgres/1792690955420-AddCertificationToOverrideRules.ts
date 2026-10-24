import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCertificationToOverrideRules1792690955420 implements MigrationInterface {
  name = 'AddCertificationToOverrideRules1792690955420';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "override_rule" ADD "certification" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "override_rule" DROP COLUMN "certification"`
    );
  }
}
