"use client";

import { useId, useState } from "react";
import { Gift, Globe, Plus, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { m } from "motion/react";
import MotionProvider from "@/components/motion/MotionProvider";
import styles from "./landing.module.css";

const FAQ: { q: string; a: string; icon: LucideIcon }[] = [
  {
    q: "Where do the problems come from?",
    a: "Public posts from the last 12 months: forums, app reviews, product reviews and social posts. Every complaint links to the original, so you can read it yourself.",
    icon: Globe,
  },
  {
    q: "Can I trust what it finds?",
    a: "The complaints and quotes are real and traceable. The verdict is worked out from the evidence, like how many independent sources mention a problem. The ideas are AI-written starting points, and each one says what’s still unproven.",
    icon: ShieldCheck,
  },
  {
    q: "Will it tell me if this already exists?",
    a: "Deep and Deepest searches look for the closest existing product and show it next to the idea. It’s a quick check, so look around yourself before you build.",
    icon: Search,
  },
  {
    q: "Is it really free?",
    a: "Yes. You can start without an account, and a free account adds deeper research. If paid plans come later, what’s free today stays free.",
    icon: Gift,
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function FaqList() {
  return (
    <MotionProvider>
      <div className={styles.faq}>
        {FAQ.map((item) => (
          <FaqItem key={item.q} {...item} />
        ))}
      </div>
    </MotionProvider>
  );
}

function FaqItem({ q, a, icon: Icon }: { q: string; a: string; icon: LucideIcon }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.faqItem}>
      <h3 className={styles.faqHead}>
        <button type="button" className={styles.faqBtn} aria-expanded={open} aria-controls={id} onClick={() => setOpen((wasOpen) => !wasOpen)}>
          <span className={`${styles.tile} ${styles.pearl} ${styles.faqTile}`}>
            <Icon strokeWidth={2} aria-hidden="true" />
          </span>
          <span className={styles.faqQ}>{q}</span>
          <m.span className={styles.faqPlus} initial={false} animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
          </m.span>
        </button>
      </h3>
      {/* always rendered so search engines can read it, inert keeps closed answers unreachable */}
      <m.div
        id={id}
        className={styles.faqPanel}
        inert={!open}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.25, delay: open ? 0.05 : 0 } }}
      >
        <m.p initial={false} animate={{ y: open ? 0 : -6 }} transition={{ duration: 0.35, ease: EASE }}>
          {a}
        </m.p>
      </m.div>
    </div>
  );
}
