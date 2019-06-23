import { Decimal } from "decimal.js";

const GRADES = new Map(
	Object.entries({
		"A+": "4.30",
		"A": "4.00",
		"A-": "3.70",
		"B+": "3.30",
		"B": "3.00",
		"B-": "2.70",
		"C+": "2.30",
		"C": "2.00",
		"C-": "1.70",
		"D+": "1.30",
		"D": "1.00",
		"D-": "0.70",
		"F": "0.00",
	}),
);

export function grade_from_str(s: string): Decimal {
	return new Decimal(GRADES.get(s) || "0.00");
}

const SHORTHANDS = new Map(
	Object.entries({
		AS: "ASIAN",
		BI: "BIO",
		CH: "CHEM",
		ES: "ENVST",
		PS: "PSCI",
		RE: "REL",
	}),
);

export function* expand_subjects(subjects: string[]) {
	for (let subject of subjects) {
		for (let code of subject.split("/")) {
			yield SHORTHANDS.get(code) || code;
		}
	}
}

export function* enumerate(iterable: any) {
	let index = 0;
	for (let item of iterable) {
		yield [index, item];
	}
}

export function* take(iter: any, n = 5) {
	for (let [i, item] of enumerate(iter)) {
		if (i >= n) {
			break;
		}
		yield item;
	}
}

export class DefaultMap<K, V> extends Map {
	private initFn: () => V;

	static empty<K, V>(init: () => V) {
		return new DefaultMap<K, V>(null, init);
	}

	constructor(entries: ReadonlyArray<[K, V]> | null, init: () => V) {
		super();
		this.initFn = init;
	}

	get(key: K): V {
		if (!this.has(key)) {
			super.set(key, this.initFn());
		}
		return super.get(key) as V;
	}
}

export function sum(iter: number[]) {
	return iter.reduce((acc, v) => acc + v, 0);
}

export function* range(start: number, end: number) {
	for (let i = start; i < end; i++) {
		yield i;
	}
}

export function difference<T>(a: Set<T>, b: Set<T>) {
	return new Set([...a].filter(x => !b.has(x)));
}

export function union<T>(a: Set<T>, b: Set<T>) {
	return new Set([...a, ...b]);
}

export function intersection<T>(a: Set<T>, b: Set<T>) {
	return new Set([...a].filter(x => b.has(x)));
}
