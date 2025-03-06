import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverrideRules1734805738349 implements MigrationInterface {
  name = 'AddOverrideRules1734805738349';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "override_rule" ("id" SERIAL NOT NULL, "radarrServiceId" integer, "sonarrServiceId" integer, "lidarrServiceId" integer, "users" character varying, "genre" character varying, "language" character varying, "keywords" character varying, "profileId" integer, "rootFolder" character varying, "tags" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_657f810c7b20a4fce45aee8f182" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "override_rule"`);
  }
}
