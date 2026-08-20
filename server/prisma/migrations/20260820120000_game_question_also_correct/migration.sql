-- With more than two teams, the host can mark one answer correct for several
-- teams at once. These are the extra teams that scored alongside the one in
-- answeredByTeamId, so undo can reverse all of them.
ALTER TABLE "GameQuestion" ADD COLUMN "alsoCorrectTeamIds" TEXT[] NOT NULL DEFAULT '{}';
