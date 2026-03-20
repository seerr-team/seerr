import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedAccounts1742858484395 implements MigrationInterface {
  name = 'AddLinkedAccounts1742858484395';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "linked_accounts" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "provider" varchar(255) NOT NULL, "sub" varchar(255) NOT NULL, "username" varchar NOT NULL, "userId" integer, CONSTRAINT "FK_2c77d2a0c06eeab6e62dc35af64" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c77d2a0c06eeab6e62dc35af6" ON "linked_accounts" ("userId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_linked_accounts_provider_sub" ON "linked_accounts" ("provider", "sub") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_linked_accounts_provider_sub"`);
    await queryRunner.query(`DROP INDEX "IDX_2c77d2a0c06eeab6e62dc35af6"`);
    await queryRunner.query(`DROP TABLE "linked_accounts"`);
  }
}
