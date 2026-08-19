-- Two questions in "معلومات عامة" duplicated the answer of another
-- question already in the same category (Mercury / oxygen), a
-- pre-existing issue from the original bulk seed predating this batch.
-- The seed script only inserts, never deletes, so simply changing the
-- source data wouldn't remove the stale rows already in the database.
-- Only deletes if the row was never actually used in a real game, to
-- avoid touching any GameQuestion foreign-key reference.
DELETE FROM "Question" q
WHERE q.text IN (
  'ما هو أصغر كوكب في المجموعة الشمسية؟',
  'ما هو الغاز الذي يحتاجه الإنسان للتنفس والبقاء على قيد الحياة؟'
)
AND NOT EXISTS (SELECT 1 FROM "GameQuestion" gq WHERE gq."questionId" = q.id);
