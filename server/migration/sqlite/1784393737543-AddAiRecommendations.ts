import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiRecommendations1784393737543 implements MigrationInterface {
  name = 'AddAiRecommendations1784393737543';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ai_recommendation table
    await queryRunner.query(
      `CREATE TABLE "ai_recommendation" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "tvdbId" integer, "score" float, "rationale" text, "metadata" text, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP) NOT NULL, "updatedAt" datetime DEFAULT (CURRENT_TIMESTAMP) NOT NULL, CONSTRAINT "FK_ai_recommendation_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AI_RECOMMENDATION_USER_TYPE" ON "ai_recommendation" ("userId", "mediaType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_AI_RECOMMENDATION_UPDATED" ON "ai_recommendation" ("updatedAt")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_AI_RECOMMENDATION_USER_TMDB_MEDIA" ON "ai_recommendation" ("userId", "tmdbId", "mediaType")`
    );

    // Create user_feedback table
    await queryRunner.query(
      `CREATE TABLE "user_feedback" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "feedbackType" varchar NOT NULL, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP) NOT NULL, CONSTRAINT "FK_user_feedback_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_USER_FEEDBACK_USER_MEDIA" ON "user_feedback" ("userId", "tmdbId", "mediaType")`
    );

    // Add aiProviderConfig to user_settings
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD COLUMN "aiProviderConfig" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "aiProviderConfig"`
    );
    await queryRunner.query(`DROP INDEX "IDX_USER_FEEDBACK_USER_MEDIA"`);
    await queryRunner.query(`DROP TABLE "user_feedback"`);
    await queryRunner.query(
      `DROP INDEX "IDX_AI_RECOMMENDATION_USER_TMDB_MEDIA"`
    );
    await queryRunner.query(`DROP INDEX "IDX_AI_RECOMMENDATION_UPDATED"`);
    await queryRunner.query(`DROP INDEX "IDX_AI_RECOMMENDATION_USER_TYPE"`);
    await queryRunner.query(`DROP TABLE "ai_recommendation"`);
  }
}
