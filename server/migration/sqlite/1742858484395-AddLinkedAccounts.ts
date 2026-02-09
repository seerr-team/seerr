import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedAccounts1742858484395 implements MigrationInterface {
  name = 'AddLinkedAccounts1742858484395';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "linked_accounts" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "provider" varchar(255) NOT NULL, "sub" varchar(255) NOT NULL, "username" varchar NOT NULL, "userId" integer, CONSTRAINT "FK_2c77d2a0c06eeab6e62dc35af64" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "linked_accounts"`);
  }
}
