"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type GlitchButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "forest" | "cream";
};

export function GlitchButton({ tone = "forest", className, children, ...props }: GlitchButtonProps) {
  return (
    <button type="button" className={cn("glitch-cta", `glitch-cta--${tone}`, className)} {...props}>
      <span className="glitch-cta-edge" aria-hidden="true" />
      <span className="glitch-cta-face" aria-hidden="true" />
      <span className="glitch-cta-label">{children}</span>
    </button>
  );
}
