-- A trap answer looks right and is deliberately outside the top ten. It is
-- never shown as a slot to guess; saying it costs the team `points`.
ALTER TABLE "QuestionAnswer" ADD COLUMN "isTrap" BOOLEAN NOT NULL DEFAULT false;
