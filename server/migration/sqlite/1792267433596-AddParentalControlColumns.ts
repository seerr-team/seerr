import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentalControlColumns1792267433596 implements MigrationInterface {
  name = 'AddParentalControlColumns1792267433596';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_settings');
    const columns = [
      ['maxMovieRating', 'varchar'],
      ['maxTvRating', 'varchar'],
      ['blockUnrated', 'boolean NOT NULL DEFAULT (0)'],
    ];
    for (const [name, type] of columns) {
      if (!table?.findColumnByName(name)) {
        await queryRunner.query(
          `ALTER TABLE "user_settings" ADD "${name}" ${type}`
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "blockUnrated"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxTvRating"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "maxMovieRating"`
    );
  }
}
