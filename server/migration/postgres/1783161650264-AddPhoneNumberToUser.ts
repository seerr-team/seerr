import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneNumberToUser1783161650264 implements MigrationInterface {
  name = 'AddPhoneNumberToUser1783161650264';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "phoneNumber" character varying(20)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phoneNumber"`);
  }
}
