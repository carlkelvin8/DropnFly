-- QR references now use the single tx_prefix setting. The old key is no
-- longer read by the application and only created duplicate administration UI.
DELETE FROM "SystemSetting" WHERE "key" = 'qr_code_prefix';
