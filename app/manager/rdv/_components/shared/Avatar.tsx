"use client";

import { memo } from "react";
import { hashColor } from "../../_lib/formatters";

export const Avatar = memo(function Avatar({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  const color = hashColor(name);
  const first = name
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "grid",
        placeContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "white",
        flexShrink: 0,
      }}
    >
      {first}
    </div>
  );
});
