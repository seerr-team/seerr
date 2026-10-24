import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterDiscoverSliderDataToText1789300000000
  implements MigrationInterface
{
  name = 'AlterDiscoverSliderDataToText1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discover_slider" ALTER COLUMN "data" TYPE text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discover_slider" ALTER COLUMN "data" TYPE character varying`
    );
  }
}
