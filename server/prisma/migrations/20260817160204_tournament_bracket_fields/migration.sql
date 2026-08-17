-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TournamentMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "orderInRound" INTEGER NOT NULL DEFAULT 0,
    "teamAName" TEXT,
    "teamBName" TEXT,
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "winnerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TournamentMatch" ("id", "round", "status", "teamAName", "teamAScore", "teamBName", "teamBScore", "tournamentId", "winnerName") SELECT "id", "round", "status", "teamAName", "teamAScore", "teamBName", "teamBScore", "tournamentId", "winnerName" FROM "TournamentMatch";
DROP TABLE "TournamentMatch";
ALTER TABLE "new_TournamentMatch" RENAME TO "TournamentMatch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
