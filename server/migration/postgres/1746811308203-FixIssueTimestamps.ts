import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FixIssueTimestamps1746811308203 implements MigrationInterface {
  name = 'FixIssueTimestamps1746811308203';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "watchlist"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "watchlist"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "override_rule"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "override_rule"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season_request"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season_request"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media_request"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media_request"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user_push_subscription"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "blacklist"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue_comment"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue_comment"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "discover_slider"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "discover_slider"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE "discover_slider"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "discover_slider"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue_comment"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue_comment"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "issue"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "blacklist"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "user_push_subscription"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media_request"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "media_request"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season_request"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "season_request"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "override_rule"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "override_rule"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "watchlist"
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP
        USING "updatedAt" AT TIME ZONE 'UTC'
      `);
    await queryRunner.query(`
        ALTER TABLE "watchlist"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP
        USING "createdAt" AT TIME ZONE 'UTC'
      `);
  }
}
