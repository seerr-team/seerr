import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLidarrServiceIdToOverrideRules1742734885291
  implements MigrationInterface
{
  name = 'AddLidarrServiceIdToOverrideRules1742734885291';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "override_rule" ADD "lidarrServiceId" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "override_rule" DROP COLUMN "lidarrServiceId"`
    );
  }
}
