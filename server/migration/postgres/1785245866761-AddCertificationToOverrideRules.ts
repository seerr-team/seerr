import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCertificationToOverrideRules1785245866761 implements MigrationInterface {
  name = 'AddCertificationToOverrideRules1785245866761';

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
