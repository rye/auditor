import { loggers } from "winston";
import { Decimal } from "decimal.js";

import { grade_from_str, expand_subjects } from "./lib";
import { Clause, SingleClause, AndClause, OrClause } from "./clause";

const logging = loggers.get("degreepath");

export class Term {
	readonly type = "term";
	readonly term: number;

	constructor(term: number) {
		this.term = term;
	}

	get year() {
		return parseInt(this.term.toString().substr(0, 4), 10);
	}

	get semester() {
		return parseInt(this.term.toString().substr(4, 1), 10);
	}

	toJSON() {
		return { type: this.type, year: this.year, semester: this.semester };
	}
}

export enum CourseStatus {
	Ok,
	InProgress,
	DidNotComplete,
	Repeated,
	NotTaken,
}

export class CourseInstance {
	readonly credits: string;
	readonly subject: ReadonlyArray<string>;
	readonly number: string;
	readonly section?: string;

	readonly transcript_code: string;
	readonly clbid: string;
	// readonly crsid?: string
	readonly gereqs: ReadonlyArray<string>;
	readonly term: Term;

	readonly is_lab: boolean;
	readonly is_flac: boolean;
	readonly is_ace: boolean;
	readonly is_topic: boolean;

	readonly name: string;
	readonly grade: Decimal;

	readonly gradeopt: string;
	readonly level: number;
	readonly attributes: ReadonlyArray<string>;

	readonly status: CourseStatus;

	readonly identity: string;
	readonly shorthand: string;
	readonly institution: string;

	constructor(data: { [key: string]: any }) {
		this.credits = data.credits;
		this.subject = data.subject;
		this.number = data.number;
		this.section = data.section;
		this.transcript_code = data.transcript_code;
		this.clbid = data.clbid;
		this.gereqs = data.gereqs;
		this.term = data.term;
		this.is_lab = data.is_lab;
		this.is_flac = data.is_flac;
		this.is_ace = data.is_ace;
		this.is_topic = data.is_topic;
		this.name = data.name;
		this.grade = data.grade;
		this.gradeopt = data.gradeopt;
		this.level = data.level;
		this.attributes = data.attributes;
		this.status = data.status;
		this.identity = data.identity;
		this.shorthand = data.shorthand;
		this.institution = data.institution;
	}

	static attachAttrs(course: CourseInstance, attributes: string[] = []) {
		return new CourseInstance({
			credits: course.credits,
			subject: course.subject,
			number: course.number,
			section: course.section,
			transcript_code: course.transcript_code,
			clbid: course.clbid,
			gereqs: course.gereqs,
			term: course.term,
			is_lab: course.is_lab,
			is_flac: course.is_flac,
			is_ace: course.is_ace,
			is_topic: course.is_topic,
			name: course.name,
			grade: course.grade,
			gradeopt: course.gradeopt,
			level: course.level,
			status: course.status,
			identity: course.identity,
			shorthand: course.shorthand,
			institution: course.institution,
			attributes: attributes,
		});
	}

	course() {
		return this.identity;
	}

	course_shorthand() {
		return this.shorthand;
	}

	hasKey(key: keyof CourseInstance): boolean {
		return this.hasOwnProperty(key);
	}

	getKey(key: keyof CourseInstance): any {
		return this[key];
	}

	apply_clause(clause: Clause): boolean {
		if (clause instanceof AndClause) {
			logging.debug(`clause/and/compare ${clause.toString()}`);
			return clause.children.every(this.apply_clause);
		} else if (clause instanceof OrClause) {
			logging.debug(`clause/or/compare ${clause.toString()}`);
			return clause.children.some(this.apply_clause);
		} else if (clause instanceof SingleClause) {
			if (this.hasKey(clause.key as any)) {
				logging.debug(`clause/compare/key=${clause.key}`);
				return clause.compare(this.getKey(clause.key as any));
			} else {
				let keys = Object.keys(this);
				logging.debug(
					`clause/compare[${clause.key}]: not found in ${keys.join(",")}`,
				);
				return false;
			}
		}

		throw new TypeError(`expected a clause; found ${clause}`);
	}
}

export function loadCourse(data: { [key: string]: any }) {
	let {
		grade,
		transcript_code = null,
		graded,
		credits,
		subjects = null,
		course,
		number = null,
		attributes = null,
		name,
		section,
		clbid,
		gereqs,
		term,
		lab,
		is_repeat,
		incomplete,
		semester,
		year,
		institution = "St. Olaf College",
	} = data;

	let status = CourseStatus.Ok;

	if (grade == "IP") {
		status = CourseStatus.InProgress;
	}

	if (transcript_code == "") {
		transcript_code = null;
	}

	if (transcript_code == "R") {
		status = CourseStatus.Repeated;
	}

	if (incomplete) {
		status = CourseStatus.DidNotComplete;
	}

	if (number == "") {
		return null;
	}

	// TODO: handle did-not-complete courses

	clbid = clbid;
	term = new Term(term);

	let gradeopt = graded;

	let is_lab = lab;
	// TODO: export is_flac/is_ace from sis
	let is_flac = name.startsWith("FLC - ");
	let is_ace = false;

	// TODO: export the course type
	let is_topic = name.startsWith("Top: ");

	grade = grade_from_str(grade);

	let roundMode = Decimal.rounding;
	Decimal.set({ rounding: Decimal.ROUND_HALF_DOWN });
	credits = new Decimal(credits).toFixed(2);
	Decimal.set({ rounding: roundMode });

	let subject = subjects != null ? subjects : [course.split(" ")[0]];
	subject = [...expand_subjects(subject)];
	// we want to keep the original shorthand course identity for matching purposes

	number = number != null ? number : course.split(" ")[1];
	number = number.toString();

	section = section != "" ? section : null;

	let level = parseInt(number, 10);
	level = level === NaN ? 0 : level;

	attributes = attributes != null ? attributes : [];
	gereqs = gereqs != null ? gereqs : [];

	let course_identity = null;
	let course_identity_short = null;
	if (is_lab) {
		course_identity = `${subject.join("/")} ${number}.L`;
		course_identity_short = `${subjects.join("/")} ${number}.L`;
	} else if (is_flac) {
		course_identity = `${subject.join("/")} ${number}.F`;
		course_identity_short = `${subjects.join("/")} ${number}.F`;
	} else {
		course_identity = `${subject.join("/")} ${number}`;
		course_identity_short = `${subjects.join("/")} ${number}`;
	}

	return new CourseInstance({
		status: status,
		credits: credits,
		subject: subject,
		number: number,
		section: section,
		transcript_code: transcript_code,
		clbid: clbid,
		gereqs: gereqs,
		term: term,
		is_lab: is_lab,
		name: name,
		grade: grade,
		gradeopt: gradeopt,
		level: level,
		attributes: attributes,
		is_flac: is_flac,
		is_ace: is_ace,
		is_topic: is_topic,
		identity: course_identity,
		shorthand: course_identity_short,
		institution: institution,
	});
}
