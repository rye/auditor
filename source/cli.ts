import { logger } from "./logging";

import { readFileSync, existsSync, unlinkSync, writeFileSync } from "fs";

import { Decimal } from "decimal.js";
import makeDir from "make-dir";
import * as path from "path";
import { parse as parseYaml } from "yaml";

import prettyMs from "pretty-ms";
import { AreaOfStudy } from "./area";
import { CourseInstance, CourseStatus } from "./data";
import { Operator } from "./clause";

import { take, sum, intersection, DefaultMap, enumerate } from "./lib";

import yargs from "yargs";
import { performance } from "perf_hooks";

type Student = {
	stnum: string;
	courses: readonly any[];
	degrees: readonly string[];
	majors: readonly string[];
	concentrations: readonly string[];
};

// Audits a student against their areas of study.
function main() {
	let args = yargs
		.scriptName("degreepath")
		.usage("Usage: $0 [options] <student> --area <area-file>")
		.strict()
		.option("print-every", {
			alias: "e",
			default: 1000,
			describe: "Print a message every N iterations",
			type: "number",
		})
		.option("loglevel", {
			alias: "l",
			default: "warn",
			describe: "Forcibly set the log level",
			choices: ["warn", "info", "debug"],
		})
		.option("print-all", {
			default: false,
			describe: "Print every audit result (only prints the best one if false)",
			type: "boolean",
		})
		.option("estimate", {
			default: false,
			describe: "Only estimate the number of runs required",
			type: "boolean",
		})
		.option("record", {
			default: true,
			describe: "Record the audit results on-disk",
			type: "boolean",
		})
		.option("print", {
			default: true,
			describe: "Print the audit results to stdout",
			type: "boolean",
		})
		.option("json", {
			default: false,
			describe: "Print the audit results as JSON",
			type: "boolean",
		})
		.option("area", {
			default: [],
			type: "array",
			describe: "Path(s) to the area(s) to audit in the student(s)",
		})
		.option("student", {
			default: [],
			type: "array",
			describe: "Path(s) to the students(s) to audit",
		}).argv;

	// if (args.loglevel == "warn"):
	//     logger.setLevel(logging.WARNING)
	//     coloredlogs.install(level="WARNING", logger=logger, fmt=logformat)
	// elif loglevel.lower() == "debug":
	//     logger.setLevel(logging.DEBUG)
	//     coloredlogs.install(level="DEBUG", logger=logger, fmt=logformat)
	// elif loglevel.lower() == "info":
	//     logger.setLevel(logging.INFO)
	//     coloredlogs.install(level="INFO", logger=logger, fmt=logformat)

	let areas = [];
	let allowed: DefaultMap<string, Set<string>> = DefaultMap.empty(
		() => new Set(),
	);
	for (let f of args.area) {
		let text = readFileSync(f, { encoding: "utf-8" });
		let a = parseYaml(text);
		areas.push(a);
		allowed.get(a["type"]).add(a["name"]);
	}

	let students = [];
	for (let f of args.student) {
		let text = readFileSync(f, { encoding: "utf-8" });
		let s = JSON.parse(text);

		if (intersection(new Set(s["degrees"]), allowed.get("degree"))) {
			students.push(s);
		} else if (intersection(new Set(s["majors"]), allowed.get("major"))) {
			students.push(s);
		} else if (
			intersection(new Set(s["concentrations"]), allowed.get("concentration"))
		) {
			students.push(s);
		} else {
			console.warn(
				`skipping student ${f} as their majors/degrees/concentrations were not loaded`,
			);
		}
	}

	run(students, areas, allowed, args);
}

function run(
	students: Student[],
	areas: any[],
	allowed: DefaultMap<string, Set<string>>,
	args: any,
) {
	if (!students.length) {
		console.error("no students to process");
	}

	for (let [i, student] of enumerate(students)) {
		let transcript: CourseInstance[] = [];
		for (let row of student["courses"]) {
			let instance = new CourseInstance(row);
			if (instance) {
				transcript.push(instance);
			}
		}

		let degree_names: Set<string> = new Set(student["degrees"]);
		let allowed_degree_names: Set<string> = intersection(
			degree_names,
			allowed.get("degree"),
		);

		let major_names: Set<string> = new Set(student["majors"]);
		let allowed_major_names: Set<string> = intersection(
			major_names,
			allowed.get("major"),
		);

		let conc_names: Set<string> = new Set(student["concentrations"]);
		let allowed_conc_names: Set<string> = intersection(
			conc_names,
			allowed.get("concentration"),
		);

		// TODO
		let allowed_area_names: Array<string> = Array.from(
			new Set([
				...allowed_major_names,
				...allowed_conc_names,
				...allowed_degree_names,
			]),
		);

		for (let area_name of allowed_area_names) {
			let area_def = areas.find(a => a["name"] == area_name);

			audit(
				(student = student),
				(area_def = area_def),
				(transcript = transcript),
				args,
			);
		}
	}
}

function audit(
	student: Student,
	area_def: any,
	transcript: CourseInstance[],
	args: any,
) {
	console.error(`auditing #${student["stnum"]}"`);

	let area = new AreaOfStudy(area_def);

	area.validate();

	let this_transcript = [];
	for (let c of transcript) {
		let attributes =
			area.attributes.get(c.course()) ||
			area.attributes.get(c.course_shorthand()) ||
			[];
		c = CourseInstance.attachAttrs(c, attributes);
		this_transcript.push(c);
	}

	let start = performance.now();

	let best_sol = null;
	let total_count = 0;

	let times = [];

	let iter_start = performance.now();
	let iter_end;

	for (let sol of area.solutions({ transcript: this_transcript })) {
		total_count += 1;

		if (total_count % args.print_every == 0) {
			console.error(`... ${total_count}`);
		}

		let result = sol.audit({ transcript: this_transcript });

		if (!best_sol) {
			best_sol = result;
		}

		if (result.rank() > best_sol.rank()) {
			best_sol = result;
		}

		if (result.ok()) {
			iter_end = performance.now();
			times.push(iter_end - iter_start);
			break;
		}

		iter_end = performance.now();
		times.push(iter_end - iter_start);

		// if (args.print_all) {
		// 	let elapsed = prettyMs((iter_end - start) * 1000);
		// 	console.log(
		// 		[
		// 			...summarize({
		// 				name: student["name"],
		// 				stnum: student["stnum"],
		// 				area: area,
		// 				result: result,
		// 				count: total_count,
		// 				elapsed: elapsed,
		// 				iterations: times,
		// 			}),
		// 		].join(""),
		// 	);
		// }

		iter_start = performance.now();
	}

	if (!times.length) {
		console.log("no audits completed");
		return;
	}

	if (args.should_print && !args.json) {
		console.log();
	}

	let end = performance.now();
	let elapsed = prettyMs((end - start) * 1000);

	console.log(JSON.stringify(best_sol));

	// let output = [
	// 	...summarize({
	// 		name: student["name"],
	// 		stnum: student["stnum"],
	// 		area: area,
	// 		result: best_sol,
	// 		count: total_count,
	// 		elapsed: elapsed,
	// 		iterations: times,
	// 	}),
	// ].join("");

	// if (args.should_record) {
	// 	let filename = `${student["stnum"]} ${student["name"]}.txt`;

	// 	let outdir = "./output";
	// 	let areadir = area.name.replace("/", "_");
	// 	let now = new Date();
	// 	let datestring = `${now.getMonth()} ${now.getDate()}`;
	// 	areadir = `${areadir} - ${datestring}`;

	// 	let ok_path = path.join(outdir, areadir, "ok");
	// 	makeDir(ok_path);

	// 	let fail_path = path.join(outdir, areadir, "fail");
	// 	makeDir(fail_path);

	// 	let ok = best_sol.ok();

	// 	let container = ok ? ok_path : fail_path;
	// 	let otherpath = path.join(
	// 		container == ok_path ? ok_path : fail_path,
	// 		filename,
	// 	);

	// 	if (existsSync(otherpath)) {
	// 		unlinkSync(otherpath);
	// 	}

	// 	let outpath = path.join(container, filename);

	// 	writeFileSync(outpath, output, { encoding: "utf-8" });
	// }

	// if (args.should_print) {
	// 	console.log(output);
	// }
}

/*
function* summarize({name, stnum, area, result, count, elapsed, iterations}) {
    let times = iterations

    let avg_iter_s = sum(times) / Math.max(times.length, 1)
    let avg_iter_time = prettyMs(avg_iter_s * 1_000, {formatSubMilliseconds: true, unitCount: 1})

    let endl = "\n"

    yield `[#${stnum}] ${name}\'s "${area.name}" ${area.kind}`

    if (result.ok()) {
        yield ` audit was successful.`
    } else {
        yield ` audit failed.`
    }

    yield ` (rank {result.rank()})`

    yield endl

    let word = count == 1 ? "attempt" : "attempts"
    yield `${count} ${word} in ${elapsed} (avg ${avg_iter_time} per attempt)`
    yield endl

    yield endl

    yield "Results"
    yield endl
    yield "======="

    yield endl
    yield endl

    yield [...print_result(result)].join(endl)

    yield endl
    }


function* print_result(rule: any, indent=0) {
    let prefix = " ".repeat(indent)

    if (!rule) {
        yield `${prefix}???`
        return
    }

    let rule_type = rule["type"]

    if (rule_type == "course") {
        let status = "🌀      "
        if ("ok" in rule && rule["ok"]) {
            let claim = rule["claims"][0]["claim"]
            let course = claim["course"]

            if (course["status"] == CourseStatus.Ok) {
                status = "💚 [ ok]"
            }else if (course["status"] == CourseStatus.DidNotComplete) {
                status = "⛔️ [dnf]"
            }else if (course["status"] == CourseStatus.InProgress) {
                status = "💚 [ ip]"
            }else if (course["status"] == CourseStatus.Repeated) {
                status = "💚 [rep]"
            }else if (course["status"] == CourseStatus.NotTaken) {
                status = "🌀      "
        }

        yield `${prefix}${status} ${rule['course']}`
    }

    elif rule_type == "count":
        if rule["status"] == "pass":
            emoji = "💚"
        elif rule["status"] == "skip":
            emoji = "🌀"
        else:
            emoji = "🚫️"

        size = len(rule["items"])
        if rule["count"] == 1 and size == 2:
            descr = f"either of (these {size})"
        elif rule["count"] == 2 and size == 2:
            descr = f"both of (these {size})"
        elif rule["count"] == size:
            descr = f"all of (these {size})"
        elif rule["count"] == 1:
            descr = f"any of (these {size})"
        else:
            descr = f"{rule['count']} of {size}"

        ok_count = len([r for r in rule["items"] if r["ok"]])
        descr += f" (ok: {ok_count}; need: {rule['count']})"

        yield f"{prefix}{emoji} {descr}"

        for r in rule["items"]:
            yield from print_result(r, indent=indent + 4)

    elif rule_type == "from":
        if rule["status"] == "pass":
            emoji = "💚"
        elif rule["status"] == "skip":
            emoji = "🌀"
        else:
            emoji = "🚫️"

        yield f"{prefix}{emoji} Given courses matching {str_clause(rule['where'])}"

        if rule["claims"]:
            yield f"{prefix} Matching courses:"
            for c in rule["claims"]:
                yield f"{prefix}   {c['claim']['course']['shorthand']} \"{c['claim']['course']['name']}\" ({c['claim']['course']['clbid']})"

        if rule["failures"]:
            yield f"{prefix} Pre-claimed courses which cannot be re-claimed:"
            for c in rule["failures"]:
                yield f"{prefix}   {c['claim']['course']['shorthand']} \"{c['claim']['course']['name']}\" ({c['claim']['course']['clbid']})"

        action_desc = ""
        action = rule["action"]
        if action["operator"] == Operator.GreaterThanOrEqualTo.name:
            action_desc = f"at least {action['compare_to']}"
        elif action["operator"] == Operator.GreaterThan.name:
            action_desc = f"at least {action['compare_to']}"
        elif action["operator"] == Operator.LessThanOrEqualTo.name:
            action_desc = f"at least {action['compare_to']}"
        elif action["operator"] == Operator.LessThan.name:
            action_desc = f"at least {action['compare_to']}"
        elif action["operator"] == Operator.EqualTo.name:
            action_desc = f"at least {action['compare_to']}"

        if action["source"] == "courses":
            word = "course" if action["compare_to"] == 1 else "courses"
        else:
            word = "items"

        yield f"{prefix} There must be {action_desc} matching {word} (have: {len(rule['claims'])}; need: {action['compare_to']})"

    elif rule_type == "requirement":
        if rule["status"] == "pass":
            emoji = "💚"
        elif rule["status"] == "skip":
            emoji = "🌀"
        else:
            emoji = "🚫️"

        yield f"{prefix}{emoji} Requirement({rule['name']})"
        if rule["audited_by"] is not None:
            yield f"{prefix}    Audited by: {rule['audited_by']}; assuming success"
            return
        yield from print_result(rule["result"], indent=indent + 4)

    elif rule_type == "reference":
        if rule["status"] == "pass":
            emoji = "💚"
        elif rule["status"] == "skip":
            emoji = "🌀"
        else:
            emoji = "🚫️"

        yield f"{prefix}{emoji} Requirement({rule['name']})"
        yield f"{prefix}   [Skipped]"

    else:
        yield json.dumps(rule, indent=2)
}
*/
main();
