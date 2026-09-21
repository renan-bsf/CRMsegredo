import { businessDate } from "./domain";
export function pageParam(v?: string) {
  const n = Number(v ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1;
}
export function monthParam(v?: string) {
  return v && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(v) && Number(v.slice(0, 4)) >= 2020
    ? v
    : businessDate().slice(0, 7);
}
export function queryParam(v?: string) {
  return (v ?? "").trim().slice(0, 100);
}
