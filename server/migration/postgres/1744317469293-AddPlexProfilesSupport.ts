// Create a new migration file
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPlexProfilesSupport1744317469293 implements MigrationInterface {
  name = 'AddPlexProfilesSupport1744317469293';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('user', [
      new TableColumn({
        name: 'plexProfileId',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'isPlexProfile',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'mainPlexUserId',
        type: 'integer',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user', 'plexProfileId');
    await queryRunner.dropColumn('user', 'isPlexProfile');
    await queryRunner.dropColumn('user', 'mainPlexUserId');
  }
}
