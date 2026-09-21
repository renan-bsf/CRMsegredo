import { beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  findUnique: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/server/config", () => ({ isDemo: () => false, isConfigured: () => true }));
vi.mock("@/lib/server/supabase", () => ({
  supabase: async () => ({ auth: { getUser: fixtures.getUser, getClaims: fixtures.getClaims } }),
}));
vi.mock("@/lib/server/db", () => ({
  db: () => ({
    member: { findUnique: fixtures.findUnique },
    $transaction: async (work: (tx: unknown) => unknown) =>
      work({ $executeRaw: fixtures.execute, $queryRaw: fixtures.query }),
  }),
}));
import { requireActor } from "@/lib/server/auth";
beforeEach(() => {
  vi.resetAllMocks();
  fixtures.getUser.mockResolvedValue({
    data: { user: { id: "user-1", user_metadata: { role: "ADMIN" } } },
    error: null,
  });
  fixtures.getClaims.mockResolvedValue({
    data: { claims: { sub: "user-1", session_id: "session-1", aal: "aal2" } },
    error: null,
  });
  fixtures.findUnique.mockResolvedValue({
    id: "user-1",
    name: "Operador",
    role: "OPERATOR",
    active: true,
  });
  fixtures.query.mockResolvedValue([{ valid: true }]);
});
describe("guardas reais de servidor", () => {
  it("não consulta banco quando o usuário não está autenticado", async () => {
    fixtures.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireActor()).rejects.toThrow("REDIRECT:/login");
    expect(fixtures.findUnique).not.toHaveBeenCalled();
  });
  it("ignora papel autodeclarado nos metadados e bloqueia operador", async () => {
    await expect(requireActor("manage")).rejects.toThrow("REDIRECT:/?denied=1");
    expect((await requireActor()).role).toBe("OPERATOR");
  });
  it("recusa membro inativo mesmo com JWT válido", async () => {
    fixtures.findUnique.mockResolvedValue({ active: false });
    await expect(requireActor()).rejects.toThrow("REDIRECT:/login?blocked=1");
  });
  it("recusa sessão revogada mesmo com JWT não expirado", async () => {
    fixtures.query.mockResolvedValue([{ valid: false }]);
    await expect(requireActor()).rejects.toThrow("REDIRECT:/login");
  });
  it("exige MFA para dados, permitindo somente a configuração em AAL1", async () => {
    fixtures.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", session_id: "session-1", aal: "aal1" } },
    });
    await expect(requireActor()).rejects.toThrow("REDIRECT:/seguranca");
    expect((await requireActor("operate", true)).id).toBe("user-1");
  });
  it("recusa claims que não pertencem ao usuário validado", async () => {
    fixtures.getClaims.mockResolvedValue({
      data: { claims: { sub: "other-user", session_id: "session-1", aal: "aal2" } },
    });
    await expect(requireActor()).rejects.toThrow("REDIRECT:/login");
  });
});
