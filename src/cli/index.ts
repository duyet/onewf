#!/usr/bin/env bun

import { $ } from "bun";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "deploy": {
      const dryRun = args.includes("--dry-run");
      const cmd = dryRun ? "wrangler deploy --dry-run" : "wrangler deploy";
      console.log(`Running: ${cmd}`);
      await $`${cmd}`;
      break;
    }
    case "dev": {
      const port = args[1] ? `--port ${args[1]}` : "";
      console.log(`Running: wrangler dev ${port}`);
      await $`wrangler dev ${port}`;
      break;
    }
    case "logs": {
      const tail = args.includes("--tail") || args.includes("-t");
      const cmd = tail ? "wrangler tail" : "wrangler tail --once";
      console.log(`Running: ${cmd}`);
      await $`${cmd}`;
      break;
    }
    case "test": {
      const filter = args[1] ? `--filter ${args[1]}` : "";
      console.log(`Running: bun test ${filter}`);
      await $`bun test ${filter}`;
      break;
    }
    case "migrate": {
      const remote = args.includes("--remote");
      const cmd = remote
        ? "wrangler d1 migrations apply onalert-db --remote"
        : "wrangler d1 migrations apply onalert-db --local";
      console.log(`Running: ${cmd}`);
      await $`${cmd}`;
      break;
    }
    case "help":
    default: {
      console.log(`
onalert CLI - Cloudflare Workflows Alerting Platform

Usage: bun run cli.ts <command> [options]

Commands:
  deploy [--dry-run]    Deploy the worker to Cloudflare
  dev [port]            Start local development server
  logs [--tail|-t]      View worker logs (tail or once)
  test [filter]         Run test suite (optional filter)
  migrate [--remote]    Apply D1 migrations
  help                  Show this help message

Examples:
  bun run cli.ts deploy
  bun run cli.ts deploy --dry-run
  bun run cli.ts dev 8787
  bun run cli.ts logs --tail
  bun run cli.ts test
  bun run cli.ts migrate --remote
      `);
      process.exit(command === "help" ? 0 : 1);
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});