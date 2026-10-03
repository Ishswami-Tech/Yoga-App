"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useApp, View } from "@/lib/store";

// Smooth fade+slide transition between views. Wrap the per-view content
// inside <ViewTransition> in each role app and it will animate on view change.
export function ViewTransition({ children, view }: { children: React.ReactNode; view: View | string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Convenience hook for the active view key (so we don't import useApp in every app).
export function useActiveView(): View {
  return useApp((s) => s.view);
}
