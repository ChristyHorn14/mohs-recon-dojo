import rawCases from "@/data/cases.json";
import type { MohsCase } from "@/lib/types";

const allCases = rawCases as MohsCase[];

export const publishedCases = allCases.filter((item) => item.status !== "draft");
