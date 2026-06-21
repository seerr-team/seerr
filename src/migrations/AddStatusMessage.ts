import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

export class AddStatusMessage1710000000000 implements MigrationInterface {
  name = 'AddStatusMessage1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'media',
      new TableColumn({
        name: 'statusMessage',
        type: 'varchar',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('media', 'statusMessage');
  }
}
