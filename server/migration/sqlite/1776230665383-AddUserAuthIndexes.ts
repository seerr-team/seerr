import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAuthIndexes1776230665383 implements MigrationInterface {
  name = 'AddUserAuthIndexes1776230665383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_plexId" ON "user" ("plexId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_jellyfinUserId" ON "user" ("jellyfinUserId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_user_jellyfinUserId"`);
    await queryRunner.query(`DROP INDEX "IDX_user_plexId"`);
  }
}
