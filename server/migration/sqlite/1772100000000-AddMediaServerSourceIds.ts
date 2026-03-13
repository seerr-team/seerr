import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaServerSourceIds1772100000000 implements MigrationInterface {
  name = 'AddMediaServerSourceIds1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "jellyfinServerId" varchar`
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "plexServerId" varchar`);
    await queryRunner.query(`ALTER TABLE "media" ADD "plexServerId4k" varchar`);
    await queryRunner.query(
      `ALTER TABLE "media" ADD "jellyfinServerId" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "jellyfinServerId4k" varchar`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "jellyfinServerId4k"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "jellyfinServerId"`
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "plexServerId4k"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "plexServerId"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "jellyfinServerId"`
    );
  }
}
