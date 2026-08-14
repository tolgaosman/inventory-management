import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Section } from "@/components/common/section";
import { StatePanel } from "@/components/common/state-panel";

/**
 * Placeholder for a route that exists in the nav but has no module behind it
 * yet. Deliberately styled like the rest of the app rather than as an obvious
 * scaffold — a stub that looks broken reads as a bug, not as "not built yet".
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <Section index={0}>
        <StatePanel
          icon={Construction}
          tint="amber"
          title="Bu modül hazırlanıyor"
          description={`${title} yakında kullanıma açılacak.`}
        />
      </Section>
    </div>
  );
}
