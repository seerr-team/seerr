import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEpisodeUniqueConstraint1772502000000
  implements MigrationInterface
{
  name = 'AddEpisodeUniqueConstraint1772502000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove any duplicate episodes before adding the constraint.
    // Keeps the row with the lowest id for each (seasonId, episodeNumber).
    await queryRunner.query(
      `DELETE FROM "episode" a USING "episode" b
       WHERE a."id" > b."id"
         AND a."seasonId" = b."seasonId"
         AND a."episodeNumber" = b."episodeNumber"`
    );
    await queryRunner.query(
      `ALTER TABLE "episode" ADD CONSTRAINT "UQ_episode_season_number" UNIQUE ("seasonId", "episodeNumber")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "episode" DROP CONSTRAINT "UQ_episode_season_number"`
    );
  }
}
