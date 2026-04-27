import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlexUuidToUser1777262170937 implements MigrationInterface {
  name = 'AddPlexUuidToUser1777262170937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "plexUuid" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "plexUuid"`);
  }
}
