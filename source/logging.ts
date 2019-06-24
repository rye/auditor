import { format, transports, loggers } from "winston";

let winstonTransports: any[] = [
	// - Write all logs error (and below) to `error.log`.
	new transports.File({ filename: "quick-start-error.log", level: "error" }),
	// - Write to all logs with level `info` and below to `combined.log`
	// new transports.File({ filename: "quick-start-combined.log" }),
];

// If we're not in production then **ALSO** log to the `console`
// with the colorized simple format.
if (process.env.NODE_ENV !== "production") {
	winstonTransports.push(
		new transports.Console({
			format: format.combine(format.colorize(), format.simple()),
			level: "warn",
		}),
	);
}

loggers.add("degreepath", {
	level: "info",
	format: format.combine(
		format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		format.errors({ stack: true }),
		format.splat(),
		format.json(),
	),
	defaultMeta: { service: "degreepath" },
	transports: winstonTransports,
});

export const logger = loggers.get("degreepath");
