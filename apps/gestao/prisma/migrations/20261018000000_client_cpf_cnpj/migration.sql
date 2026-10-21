-- AlterTable: CPF e CNPJ do cliente em campos próprios (só dígitos)
ALTER TABLE "Client" ADD COLUMN "cpf" TEXT;
ALTER TABLE "Client" ADD COLUMN "cnpj" TEXT;

-- O documento já cadastrado vai para o campo correspondente pelo número de dígitos.
UPDATE "Client" SET "cpf" = regexp_replace("document", '\D', '', 'g') WHERE length(regexp_replace(COALESCE("document", ''), '\D', '', 'g')) = 11;
UPDATE "Client" SET "cnpj" = regexp_replace("document", '\D', '', 'g') WHERE length(regexp_replace(COALESCE("document", ''), '\D', '', 'g')) = 14;

-- O campo document passa a guardar a identificação exibida nos PDFs, com a pontuação habitual.
UPDATE "Client" SET "document" = 'CPF ' || regexp_replace("cpf", '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4') WHERE "cpf" IS NOT NULL;
UPDATE "Client" SET "document" = 'CNPJ ' || regexp_replace("cnpj", '^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$', '\1.\2.\3/\4-\5') WHERE "cnpj" IS NOT NULL;
