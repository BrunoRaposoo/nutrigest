DELETE FROM "refresh_tokens";
DELETE FROM "password_reset_tokens";

ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "token_hash";
ALTER TABLE "password_reset_tokens" DROP COLUMN IF EXISTS "token_hash";
ALTER TABLE "refresh_tokens" ADD COLUMN "token_digest" varchar(64) NOT NULL;
ALTER TABLE "password_reset_tokens" ADD COLUMN "token_digest" varchar(64) NOT NULL;
CREATE UNIQUE INDEX "refresh_tokens_token_digest_unique" ON "refresh_tokens" USING btree ("token_digest");
CREATE UNIQUE INDEX "password_reset_tokens_token_digest_unique" ON "password_reset_tokens" USING btree ("token_digest");