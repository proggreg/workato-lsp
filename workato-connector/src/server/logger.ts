import * as fs from "fs";
import * as path from "path";
import { Connection } from "vscode-languageserver";

export class Logger {
  private logFile: fs.WriteStream | null = null;
  private connection: Connection | null = null;

  constructor(logFilePath?: string) {
    if (logFilePath) {
      const dir = path.dirname(logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.logFile = fs.createWriteStream(logFilePath, { flags: "a" });
    }
  }

  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  info(message: string, ...args: unknown[]): void {
    this.log("INFO", message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("WARN", message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("ERROR", message, ...args);
  }

  private log(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? " " + JSON.stringify(args) : "";
    const line = `[${timestamp}] [${level}] ${message}${formattedArgs}`;

    if (this.logFile) {
      this.logFile.write(line + "\n");
    }

    if (this.connection) {
      switch (level) {
        case "ERROR":
          this.connection.console.error(line);
          break;
        case "WARN":
          this.connection.console.warn(line);
          break;
        default:
          this.connection.console.info(line);
          break;
      }
    }
  }

  dispose(): void {
    if (this.logFile) {
      this.logFile.end();
    }
  }
}
