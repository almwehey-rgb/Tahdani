-- Accounts that never spend a game credit, for the people running the app.
ALTER TABLE "User" ADD COLUMN "unlimitedGames" BOOLEAN NOT NULL DEFAULT false;
