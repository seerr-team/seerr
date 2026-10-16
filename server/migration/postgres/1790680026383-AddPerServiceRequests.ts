import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerServiceRequests1790680026383 implements MigrationInterface {
  name = 'AddPerServiceRequests1790680026383';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_service_status" ("id" SERIAL NOT NULL, "mediaId" integer NOT NULL, "serviceId" integer NOT NULL, "serviceType" character varying NOT NULL, "status" integer NOT NULL DEFAULT '1', "externalServiceId" integer, "externalServiceSlug" character varying, "seasonStatuses" text, CONSTRAINT "PK_66ef1735cd41b4d481cab9e5872" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53c7892b155bbe5551b8c38220" ON "media_service_status" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8f881c4ea02c07af7eb63b0be" ON "media_service_status" ("serviceId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bb780c054627c651d27f48c7b4" ON "media_service_status" ("mediaId", "serviceId") `
    );
    await queryRunner.query(
      `ALTER TABLE "media_request" ADD "isServiceRequest" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "requestServices" text`);
    await queryRunner.query(
      `ALTER TABLE "media_service_status" ADD CONSTRAINT "FK_53c7892b155bbe5551b8c38220d" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_service_status" DROP CONSTRAINT "FK_53c7892b155bbe5551b8c38220d"`
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "requestServices"`);
    await queryRunner.query(
      `ALTER TABLE "media_request" DROP COLUMN "isServiceRequest"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb780c054627c651d27f48c7b4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8f881c4ea02c07af7eb63b0be"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53c7892b155bbe5551b8c38220"`
    );
    await queryRunner.query(`DROP TABLE "media_service_status"`);
  }
}
