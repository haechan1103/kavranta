import { chmod, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const explicitTarget = process.env.KAVRANTA_TARGET || process.env.ENV_MANAGER_TARGET;
const targetTriple = explicitTarget || commandOutput("rustc", ["--print", "host-tuple"]);
const isWindows = targetTriple.includes("windows");
const executableName = isWindows ? "kavranta-broker.exe" : "kavranta-broker";
const cargoArguments = ["build", "--release", "--locked", "-p", "env-broker"];

if (explicitTarget) {
  cargoArguments.push("--target", targetTriple);
}

run("cargo", cargoArguments);

const source = explicitTarget
  ? join(repositoryRoot, "target", targetTriple, "release", executableName)
  : join(repositoryRoot, "target", "release", executableName);
const destinationName = isWindows
  ? `kavranta-broker-${targetTriple}.exe`
  : `kavranta-broker-${targetTriple}`;
const destination = join(repositoryRoot, "src-tauri", "binaries", destinationName);

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
if (!isWindows) await chmod(destination, 0o755);

process.stdout.write(`Prepared Kavranta broker sidecar for ${targetTriple}.\n`);

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
