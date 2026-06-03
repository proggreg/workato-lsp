import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit, Range } from "vscode-languageserver/node";
import { URI } from "vscode-uri";

let rubocopNotFound = false;

function findRubocopCommand(cwd: string): Array<[string, string[]]> {
  const gemfilePath = path.join(cwd, "Gemfile");
  if (fs.existsSync(gemfilePath)) {
    // Try bundle exec first, fall back to standalone rubocop
    return [
      ["bundle", ["exec", "rubocop"]],
      ["rubocop", []],
    ];
  }
  return [["rubocop", []]];
}

function versionEnv(rubyVersion: string): NodeJS.ProcessEnv {
  if (rubyVersion === "auto") return {};

  const env: NodeJS.ProcessEnv = { ...process.env };

  // rbenv / chruby: RBENV_VERSION env var selects the version
  env.RBENV_VERSION = rubyVersion;

  // Homebrew ruby@X.Y: prepend its bin dirs to PATH
  const majorMinor = rubyVersion.split(".").slice(0, 2).join(".");
  const homebrewBin = `/opt/homebrew/opt/ruby@${majorMinor}/bin`;
  const gemBin = `/opt/homebrew/lib/ruby/gems/${majorMinor}.0/bin`;
  env.PATH = `${homebrewBin}:${gemBin}:${env.PATH ?? ""}`;

  return env;
}

function spawnRubocop(
  cmd: string,
  args: string[],
  text: string,
  cwd: string,
  rubyVersion: string,
): Promise<{ stdout: string; stderr: string; code: number | null } | null> {
  return new Promise((resolve) => {
    let proc;
    try {
      if (process.platform === "win32") {
        proc = spawn(cmd, args, { cwd, shell: true });
      } else if (rubyVersion !== "auto") {
        // Specific version: use our env directly — don't let login shell overwrite PATH
        proc = spawn(cmd, args, { cwd, env: versionEnv(rubyVersion) });
      } else {
        // auto: login shell picks up ~/.zshrc PATH (homebrew, rbenv, rvm)
        const shell = process.env.SHELL || "/bin/sh";
        const shellCmd = [cmd, ...args]
          .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
          .join(" ");
        proc = spawn(shell, ["-l", "-c", shellCmd], { cwd });
      }
    } catch {
      resolve(null);
      return;
    }

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", () => resolve(null));

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

async function runRubocop(
  text: string,
  filePath: string,
  rubyVersion: string,
  notify?: (msg: string) => void,
): Promise<string | null> {
  const fileName = path.basename(filePath);
  const cwd = path.dirname(filePath);
  const candidates = findRubocopCommand(cwd);

  for (const [cmd, baseArgs] of candidates) {
    const args = [
      ...baseArgs,
      "--autocorrect-all",
      "--stderr",
      "--except",
      "Style/FrozenStringLiteralComment",
      "--stdin",
      fileName,
    ];

    const result = await spawnRubocop(cmd, args, text, cwd, rubyVersion);

    if (result === null) {
      // spawn failed (command not found) — try next candidate
      process.stderr.write(
        `[workatoFormatter] ${cmd} not available, trying next\n`,
      );
      continue;
    }

    if (result.stderr) {
      process.stderr.write(
        `[workatoFormatter] rubocop stderr: ${result.stderr}\n`,
      );
    }

    // exit 0 = clean, 1 = offenses corrected, 2+ = error
    if (result.code !== null && result.code <= 1 && result.stdout.length > 0) {
      return result.stdout;
    }

    // rubocop ran but produced no output or errored — try next candidate
    process.stderr.write(
      `[workatoFormatter] ${cmd} exit ${result.code}, stdout=${result.stdout.length}b\n`,
    );
  }

  // All candidates exhausted
  if (!rubocopNotFound) {
    rubocopNotFound = true;
    notify?.(
      "Workato LSP: rubocop not found. Install it with `gem install rubocop` to enable formatting.",
    );
  }

  return null;
}

export class WorkatoFormatter {
  static async formatDocument(
    textDocument: TextDocument,
    rubyVersion: string,
    notify?: (msg: string) => void,
  ): Promise<TextEdit[]> {
    const text = textDocument.getText();
    const uri = URI.parse(textDocument.uri);
    const filePath = uri.fsPath;

    const formatted = await runRubocop(text, filePath, rubyVersion, notify);
    if (formatted === null || formatted === text) return [];

    const lines = text.split("\n");
    const lastLine = lines.length - 1;
    const lastChar = lines[lastLine].length;

    return [
      TextEdit.replace(Range.create(0, 0, lastLine, lastChar), formatted),
    ];
  }

  static async formatRange(
    textDocument: TextDocument,
    range: Range,
    rubyVersion: string,
    notify?: (msg: string) => void,
  ): Promise<TextEdit[]> {
    const text = textDocument.getText();
    const uri = URI.parse(textDocument.uri);
    const filePath = uri.fsPath;

    // Run on full file — rubocop needs surrounding context for indentation
    const formatted = await runRubocop(text, filePath, rubyVersion, notify);
    if (formatted === null) return [];

    const oldLines = text.split("\n");
    const newLines = formatted.split("\n");

    // If line count changed rubocop restructured the file — fall back to full doc
    if (oldLines.length !== newLines.length) {
      return WorkatoFormatter.formatDocument(textDocument, rubyVersion, notify);
    }

    const startLine = range.start.line;
    const endLine = Math.min(range.end.line, oldLines.length - 1);

    // Equal line counts: oldLines[i] always aligns with newLines[i], no shift
    const edits: TextEdit[] = [];
    let i = startLine;
    while (i <= endLine) {
      if (oldLines[i] === newLines[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j <= endLine && oldLines[j] !== newLines[j]) j++;
      edits.push(
        TextEdit.replace(
          Range.create(i, 0, j - 1, oldLines[j - 1].length),
          newLines.slice(i, j).join("\n"),
        ),
      );
      i = j;
    }
    return edits;
  }
}
