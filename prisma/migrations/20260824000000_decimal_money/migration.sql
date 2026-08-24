-- AlterTable: Float → Decimal for money columns
ALTER TABLE "Booking" ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "Booking" ALTER COLUMN "discount" SET DATA TYPE DECIMAL(10,2);

ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

ALTER TABLE "PromoCode" ALTER COLUMN "value" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "PromoCode" ALTER COLUMN "minAmount" SET DATA TYPE DECIMAL(10,2);
ALTER TABLE "PromoCode" ALTER COLUMN "maxDiscount" SET DATA TYPE DECIMAL(10,2);

ALTER TABLE "StorageLocation" ALTER COLUMN "pricePerDay" SET DATA TYPE DECIMAL(10,2);

-- Rename token → tokenHash in PasswordResetToken
ALTER TABLE "PasswordResetToken" RENAME COLUMN "token" TO "tokenHash";
DROP INDEX "PasswordResetToken_token_key";
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
