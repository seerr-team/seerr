// structurally typed so it accepts both the Season entity and its serialized form
export const externalSeasonNumber = (season: {
  seasonNumber: number;
  dispatchedSeasonNumber?: number | null;
}): number => season.dispatchedSeasonNumber ?? season.seasonNumber;
