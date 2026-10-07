import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { week02 } from "./week02-data";
import { Reveal } from "../ui";

/* The homepage's Week 02 Agent Log, rendered with the Agent Log Card.
   Content (including the result below) is carried over verbatim. */

type CardProps = {
  task: string; agent: string; type: string; date: string; status: string;
  week?: number; entry?: number; prompt: string; result: ReactNode; className?: string;
};

// resolved lazily so the homepage chunk stays small
const cardModule = import.meta.glob<{ AgentLogCard: ComponentType<CardProps> }>("../components/agent-log-card/AgentLogCard.tsx");

export function Week02Section() {
  const [Card, setCard] = useState<ComponentType<CardProps> | null>(null);
  useEffect(() => {
    const load = Object.values(cardModule)[0];
    if (load) load().then(m => setCard(() => m.AgentLogCard));
  }, []);

  return (
    <section aria-labelledby="week-02-log" className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <h2 id="week-02-log" className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-2">{week02.heading}</h2>
        <span className="font-mono text-[12px] text-ink-3">{week02.range}</span>
      </div>
      <Reveal className="mt-8 flex justify-center lg:justify-start">
        {Card ? (
          <Card
            task={week02.task} agent={week02.agent} type={week02.type} date={week02.date} status={week02.status}
            week={week02.week} entry={week02.entry} prompt={week02.prompt}
            result={
              <>
                <p>Built a reusable GHL Troubleshooting Skill at <code>.claude/skills/ghl-troubleshooter/SKILL.md</code>.</p>
                <p><strong>Status:</strong> Built — Not yet tested on a real GHL issue.</p>
              </>
            }
          />
        ) : (
          <div className="h-[420px] w-full max-w-[680px] rounded-[20px] skeleton" aria-hidden />
        )}
      </Reveal>
    </section>
  );
}
