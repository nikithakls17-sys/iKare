"use client";

// Adapted from Motion Primitives' AnimatedBackground. One highlight slides between children.
// With enableHover it follows the pointer and settles back on defaultValue (e.g. the current page).
import { AnimatePresence, motion, type Transition } from "motion/react";
import { Children, cloneElement, useId, useState, type ReactElement } from "react";

type Child = ReactElement<React.HTMLAttributes<HTMLElement> & { "data-id": string; "data-checked"?: string }>;

export type AnimatedBackgroundProps = {
  children: Child[] | Child;
  defaultValue?: string;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className = "",
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [picked, setPicked] = useState<string | null>(null);
  // A new defaultValue (e.g. navigation) wins over the last pick.
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (prevDefault !== defaultValue) {
    setPrevDefault(defaultValue);
    setPicked(null);
  }
  const activeId = picked ?? defaultValue ?? null;
  const layoutId = `background-${useId()}`;

  const pick = (id: string | null) => {
    setPicked(id);
    onValueChange?.(id ?? defaultValue ?? null);
  };

  return Children.map(children, (child) => {
    const id = child.props["data-id"];
    const interaction = enableHover
      ? { onMouseEnter: () => pick(id), onMouseLeave: () => pick(null), onFocus: () => pick(id), onBlur: () => pick(null) }
      : { onClick: () => pick(id) };

    return cloneElement(
      child,
      {
        className: `relative ${child.props.className ?? ""}`,
        "data-checked": activeId === id ? "true" : "false",
        ...interaction,
      },
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={layoutId}
              className={`absolute inset-0 ${className}`}
              transition={transition}
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <span className="relative z-10 flex w-full [align-items:inherit] [flex-direction:inherit] [gap:inherit] [justify-content:inherit]">{child.props.children}</span>
      </>,
    );
  });
}
