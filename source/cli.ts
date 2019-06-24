import { readFileSync, existsSync, unlinkSync, writeFileSync } from "fs";
import { performance } from "perf_hooks";
import * as path from "path";

import makeDir from "make-dir";
import yargs from "yargs";
import { parse as parseYaml } from "yaml";
import prettyMs from "pretty-ms";

import { AreaOfStudy } from "./area";
import { CourseInstance, CourseStatus, loadCourse } from "./data";
import { Operator } from "./clause";
import { sum, intersection, DefaultMap, enumerate } from "./lib";
import { Rule } from "./rule";
import { Solution } from "./solution";
import { Result } from "./result";

type Student = {
	name: string;
	stnum: string;
	courses: readonly any[];
	degrees: readonly string[];
	majors: readonly string[];
	concentrations: readonly string[];
};

function getArgs() {
	return yargs
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
}

// Audits a student against their areas of study.
function main() {
	let args = getArgs();

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
	args: ReturnType<typeof getArgs>,
) {
	if (!students.length) {
		console.error("no students to process");
	}

	for (let [i, student] of enumerate(students)) {
		let transcript: CourseInstance[] = [];
		for (let row of student["courses"]) {
			let instance = loadCourse(row);
			if (instance) {
				transcript.push(instance);
			}
		}

		let degree_names = new Set(student["degrees"]);
		let allowed_degree_names = intersection(
			degree_names,
			allowed.get("degree"),
		);

		let major_names = new Set(student["majors"]);
		let allowed_major_names = intersection(major_names, allowed.get("major"));

		let conc_names = new Set(student["concentrations"]);
		let allowed_conc_names = intersection(
			conc_names,
			allowed.get("concentration"),
		);

		let allowed_area_names = new Set([
			...allowed_major_names,
			...allowed_conc_names,
			...allowed_degree_names,
		]);

		for (let area_name of allowed_area_names) {
			let area_def = areas.find(a => a.name == area_name);

			audit(student, area_def, transcript, args);
		}
	}
}

function audit(
	student: Student,
	area_def: any,
	transcript: CourseInstance[],
	args: ReturnType<typeof getArgs>,
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

		if (total_count % args["print-every"] === 0) {
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

		if (args["print-all"]) {
			let elapsed = prettyMs((iter_end - start) * 1000);
			let text = summarize({
				name: student.name,
				stnum: student.stnum,
				area: area,
				result: result,
				count: total_count,
				elapsed: elapsed,
				iterations: times,
			});
			console.log([...text].join(""));
		}

		iter_start = performance.now();
	}

	if (!times.length) {
		console.log("no audits completed");
		return;
	}

	if (args.print && !args.json) {
		console.log();
	}

	let end = performance.now();
	let elapsed = prettyMs(end - start);

	// console.log(JSON.stringify(best_sol));

	if (!best_sol) {
		console.error("no audits completed");
		return;
	}

	let text = summarize({
		name: student.name,
		stnum: student.stnum,
		area: area,
		result: best_sol,
		count: total_count,
		elapsed: elapsed,
		iterations: times,
	});
	let output = [...text].join("");

	if (args.record) {
		let filename = `${student.stnum} ${student.name}.txt`;

		let outdir = "./output";
		let areadir = area.name.replace("/", "_");
		let now = new Date();
		let datestring = `${now.getMonth()} ${now.getDate()}`;
		areadir = `${areadir} - ${datestring}`;

		let ok_path = path.join(outdir, areadir, "ok");
		makeDir.sync(ok_path);

		let fail_path = path.join(outdir, areadir, "fail");
		makeDir.sync(fail_path);

		let ok = best_sol.ok();

		let container = ok ? ok_path : fail_path;
		let otherpath = path.join(
			container == ok_path ? ok_path : fail_path,
			filename,
		);

		if (existsSync(otherpath)) {
			unlinkSync(otherpath);
		}

		let outpath = path.join(container, filename);

		writeFileSync(outpath, output, { encoding: "utf-8" });
	}

	if (args.print) {
		console.log(output);
	}
}

function* summarize(args: {
	name: string;
	stnum: string;
	area: any;
	result: Result;
	count: number;
	elapsed: string;
	iterations: readonly number[];
}): Iterable<string> {
	let { name, stnum, area, result, count, elapsed, iterations } = args;
	let times = iterations;

	let avg_iter_s = sum(times) / Math.max(times.length, 1);
	let avg_iter_time = prettyMs(avg_iter_s, {
		formatSubMilliseconds: true,
		unitCount: 1,
	});

	let endl = "\n";

	yield `[#${stnum}] ${name}\'s "${area.name}" ${area.kind}`;

	if (result.ok()) {
		yield ` audit was successful.`;
	} else {
		yield ` audit failed.`;
	}

	yield ` (rank ${result.rank()})`;

	yield endl;

	let word = count == 1 ? "attempt" : "attempts";
	yield `${count} ${word} in ${elapsed} (${avg_iter_time} per attempt)`;
	yield endl;

	yield endl;

	yield "Results";
	yield endl;
	yield "=======";

	yield endl;
	yield endl;

	yield [...print_result(result)].join(endl);

	// yield JSON.stringify(result, null, 2);

	yield endl;
}

function* print_result(
	rule: Rule | Solution | Result,
	indent = 0,
): IterableIterator<string> {
	let prefix = " ".repeat(indent);

	if (!rule) {
		yield `${prefix}???`;
		return;
	}

	let r: any = rule.toJSON();

	if (r.type === "course") {
		let status = "🌀      ";
		if (r.ok) {
			let claim = r.claims[0].claim;
			let course = claim.course;

			if (course.status == CourseStatus.Ok) {
				status = "💚 [ ok]";
			} else if (course.status == CourseStatus.DidNotComplete) {
				status = "⛔️ [dnf]";
			} else if (course.status == CourseStatus.InProgress) {
				status = "💚 [ ip]";
			} else if (course.status == CourseStatus.Repeated) {
				status = "💚 [rep]";
			} else if (course.status == CourseStatus.NotTaken) {
				status = "🌀      ";
			}
		}

		yield `${prefix}${status} ${r.course}`;
		return;
	}

	if (r.type === "count") {
		let emoji;
		if (r.status == "pass") {
			emoji = "💚";
		} else if (r.status == "skip") {
			emoji = "🌀";
		} else {
			emoji = "🚫️";
		}

		let size = r.items.length;
		let descr;
		if (r.count == 1 && size == 2) {
			descr = `either of (these ${size})`;
		} else if (r.count == 2 && size == 2) {
			descr = `both of (these ${size})`;
		} else if (r.count == size) {
			descr = `all of (these ${size})`;
		} else if (r.count == 1) {
			descr = `any of (these ${size})`;
		} else {
			descr = `${r.count} of ${size}`;
		}
		let ok_count = r.items.filter((r: Rule | Result | Solution) => r.ok())
			.length;
		descr += ` (ok: ${ok_count}; need: ${r.count})`;

		yield `${prefix}${emoji} ${descr}`;

		for (let item of r.items) {
			yield* print_result(item, indent + 4);
		}
		return;
	}

	if (r.type === "from") {
		let emoji;
		if (r.status == "pass") {
			emoji = "💚";
		} else if (r.status == "skip") {
			emoji = "🌀";
		} else {
			emoji = "🚫️";
		}

		yield `${prefix}${emoji} Given courses matching ${r.where.toString()}`;

		if (r.claims.length) {
			yield `${prefix} Matching courses:`;
			for (let c of r.claims) {
				yield `${prefix}   ${c["claim"]["course"]["shorthand"]} \"${c["claim"]["course"]["name"]}\" (${c["claim"]["course"]["clbid"]})`;
			}
		}

		if (r.failures.length) {
			yield `${prefix} Pre-claimed courses which cannot be re-claimed:`;
			for (let c of r.failures) {
				yield `${prefix}   ${c["claim"]["course"]["shorthand"]} \"${c["claim"]["course"]["name"]}\" (${c["claim"]["course"]["clbid"]})`;
			}
		}

		let action_desc = "";
		let action = r.action;
		if (action.operator == Operator.GreaterThanOrEqualTo) {
			action_desc = `at least ${action.compare_to}`;
		} else if (action.operator == Operator.GreaterThan) {
			action_desc = `at least ${action.compare_to}`;
		} else if (action.operator == Operator.LessThanOrEqualTo) {
			action_desc = `at least ${action.compare_to}`;
		} else if (action.operator == Operator.LessThan) {
			action_desc = `at least ${action.compare_to}`;
		} else if (action.operator == Operator.EqualTo) {
			action_desc = `at least ${action.compare_to}`;
		}

		let word;
		if (action["source"] == "courses") {
			word = action.compare_to == 1 ? "course" : "courses";
		} else {
			word = "items";
		}

		yield `${prefix} There must be ${action_desc} matching ${word} (have: ${r.claims.length}; need: ${action.compare_to})`;
		return;
	}

	if (r.type === "requirement") {
		let emoji;
		if (r.status == "pass") {
			emoji = "💚";
		} else if (r.status == "skip") {
			emoji = "🌀";
		} else {
			emoji = "🚫️";
		}

		yield `${prefix}${emoji} Requirement(${r["name"]})`;
		if (r["audited_by"] != null) {
			yield `${prefix}    Audited by: ${r["audited_by"]}; assuming success`;
			return;
		}

		if (r.result) {
			yield* print_result(r.result, indent + 4);
		} else {
			yield "(no rule is present for this requirement)";
		}
		return;
	}

	if (r.type === "reference") {
		let emoji;
		if (r.status == "pass") {
			emoji = "💚";
		} else if (r.status == "skip") {
			emoji = "🌀";
		} else {
			emoji = "🚫️";
		}

		yield `${prefix}${emoji} Requirement(${r.name})`;
		yield `${prefix}   [Skipped]`;
		return;
	}

	yield JSON.stringify(r, null, 2);
}

main();
