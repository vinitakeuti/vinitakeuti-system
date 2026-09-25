import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
spawn("node", [".next/standalone/server.js"], { stdio: "inherit", env: { ...process.env, PORT: port } });
