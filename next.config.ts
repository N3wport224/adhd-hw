import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Pinned to this directory. Turbopack otherwise walks up looking for a
  // lockfile and can settle on a parent folder, which it warns about on every
  // start and which changes how paths resolve.
  turbopack: { root: path.resolve(".") },

  // Next writes AGENTS.md and CLAUDE.md into the project on dev start. This
  // repo does not use them, and generated files appearing as untracked
  // changes before anyone has edited anything is its own small confusion.
  agentRules: false,
};

export default nextConfig;
