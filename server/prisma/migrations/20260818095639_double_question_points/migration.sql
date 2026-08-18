-- Rescale the point tiers from 100/200/300 to 200/400/600 (matches the
-- seed data, which was updated to the same scale in the same change).
-- Pure data fix, no schema change — Question.points stays an Int.
UPDATE "Question" SET points = points * 2;
