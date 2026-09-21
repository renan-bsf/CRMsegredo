import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function key() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw || Buffer.from(raw, "base64").length !== 32)
    throw new Error("Chave de criptografia inválida.");
  return Buffer.from(raw, "base64");
}
// AAD vincula o conteúdo ao cliente: trocar ciphertext entre registros falha.
export function encrypt(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}
export function decrypt(value: string, context: string) {
  const [version, iv, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra)
    throw new Error("Conteúdo criptografado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
