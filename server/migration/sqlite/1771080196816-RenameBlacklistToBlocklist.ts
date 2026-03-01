import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBlacklistToBlocklist1771080196816 implements MigrationInterface {
  name = 'RenameBlacklistToBlocklist1771080196816';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "temporary_blocklist" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "title" varchar,
        "tmdbId" integer NOT NULL,
        "blocklistedTags" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "userId" integer,
        "mediaId" integer,
        CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"),
        CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"),
        CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      INSERT INTO "temporary_blocklist" ("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId")
      SELECT "id", "mediaType", "title", "tmdbId", "blacklistedTags", "createdAt", "userId", "mediaId" FROM "blacklist"
    `);
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "blocklist" RENAME TO "blacklist"`);
    await queryRunner.query(`
      CREATE TABLE "temporary_blacklist" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "title" varchar,
        "tmdbId" integer NOT NULL,
        "blacklistedTags" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "userId" integer,
        "mediaId" integer,
        CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"),
        CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"),
        CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      INSERT INTO "temporary_blacklist" ("id", "mediaType", "title", "tmdbId", "blacklistedTags", "createdAt", "userId", "mediaId")
      SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blacklist"
    `);
    await queryRunner.query(`DROP TABLE "blacklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blacklist" RENAME TO "blacklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blacklist" ("tmdbId")`
    );
  }
}
