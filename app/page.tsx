import { CaseTrainer } from "@/components/CaseTrainer";
import { publishedCases } from "@/lib/cases";

export default function HomePage() {
  return <CaseTrainer cases={publishedCases} />;
}
