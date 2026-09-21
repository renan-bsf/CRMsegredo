"use server";
import { z } from "zod";
import { getCustomers, getInventory } from "@/lib/server/queries";
export async function findSaleProducts(input: unknown) {
  const q = z.string().trim().max(100).parse(input);
  const { rows } = await getInventory(q);
  return rows.map(({ id, name, sku, size, color, priceCents, available }) => ({
    id,
    name,
    sku,
    size,
    color,
    priceCents,
    available,
  }));
}
export async function findSaleCustomers(input: unknown) {
  const q = z.string().trim().max(100).parse(input);
  const { rows } = await getCustomers(q);
  return rows.map(({ id, name }) => ({ id, name }));
}
