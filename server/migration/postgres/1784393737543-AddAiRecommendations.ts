import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiRecommendations1784393737543 implements MigrationInterface {
  name = 'AddAiRecommendations1784393737543';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ai_recommendation table
    await queryRunner.query(
      `CREATE TABLE "ai_recommendation" ("id" SERIAL NOT NULL, "userId" integer, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "tvdbId" integer, "score" double precision, "rationale" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ai_recommendation" PRIMARY KEY ("id"), CONSTRAINT "FK_ai_recommendation_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AI_RECOMMENDATION_USER_TYPE" ON "ai_recommendation" ("userId", "mediaType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AI_RECOMMENDATION_CREATED" ON "ai_recommendation" ("createdAt")`
    );

    // Create user_feedback table
    await queryRunner.query(
      `CREATE TABLE "user_feedback" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "feedbackType" varchar NOT NULL CHECK ("feedbackType" IN ('like', 'dislike', 'seen')), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_user_feedback" PRIMARY KEY ("id"), CONSTRAINT "FK_user_feedback_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_USER_FEEDBACK_USER_MEDIA" ON "user_feedback" ("userId", "tmdbId", "mediaType")`
    );

    // Add aiProviderConfig to user_settings
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN "aiProviderConfig" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "aiProviderConfig"`);
    await queryRunner.query(`DROP INDEX "IDX_USER_FEEDBACK_USER_MEDIA"`);
    await queryRunner.query(`DROP TABLE "user_feedback"`);
    await queryRunner.query(`DROP INDEX "IDX_AI_RECOMMENDATION_CREATED"`);
    await queryRunner.query(`DROP INDEX "IDX_AI_RECOMMENDATION_USER_TYPE"`);
    await queryRunner.query(`DROP TABLE "ai_recommendation"`);
  }
}
