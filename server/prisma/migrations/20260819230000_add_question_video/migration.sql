-- Add video support to questions (e.g. "who scored this goal?" clips),
-- with an optional grayscale flag so kit colors don't give the answer away.
ALTER TABLE "Question" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "Question" ADD COLUMN "grayscale" BOOLEAN NOT NULL DEFAULT false;
