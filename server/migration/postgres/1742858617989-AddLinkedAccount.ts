import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedAccount1742858617989 implements MigrationInterface {
  name = 'AddLinkedAccount1742858617989';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "linked_accounts" ("id" SERIAL NOT NULL, "provider" character varying(255) NOT NULL, "sub" character varying(255) NOT NULL, "username" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_445bf7a50aeeb7f0084052935a6" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_accounts" ADD CONSTRAINT "FK_2c77d2a0c06eeab6e62dc35af64" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "linked_accounts" DROP CONSTRAINT "FK_2c77d2a0c06eeab6e62dc35af64"`
    );
    await queryRunner.query(`DROP TABLE "linked_accounts"`);
  }
}
