import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisplayNameToUser1611508672722 implements MigrationInterface {
  name = 'AddDisplayNameToUser1611508672722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar NOT NULL, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "username" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername") SELECT "id", "email", NULL, "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar NOT NULL, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar NOT NULL, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "password" varchar, "userType" integer NOT NULL DEFAULT (1), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
  }
}
