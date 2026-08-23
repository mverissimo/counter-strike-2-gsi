import type { ComponentType } from "react";

import { Avatar } from "./primitives/avatar.tsx";
import { Stack } from "./primitives/stack.tsx";
import { StatBar } from "./primitives/stat-bar.tsx";
import { Text } from "./primitives/text.tsx";

/**
 * Every node's `type` must resolve here. The value type is deliberately
 * loose — each primitive has its own props shape, and a spec's `props` are
 * only checked against the concrete primitive at the call site that builds
 * that node (see `player-card-spec.ts`), not through this map.
 */
export const registry: Record<string, ComponentType<any>> = {
  Stack,
  Text,
  Avatar,
  StatBar,
};
