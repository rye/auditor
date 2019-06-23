// sourced from https://github.com/ehmicky/fast-cartesian, Apache-2.0

// Does a cartesian product on several iterables.
// Works with any iterable, including arrays, strings, generators, maps, sets.
export default function fastCartesian<T>(
	...iterables: readonly Iterable<T>[]
): Array<Array<T>> {
	if (iterables.length === 0) {
		return [];
	}

	let arrays = iterables.map(arrify);

	let result: T[][] = [];
	iterate(arrays, result, [], 0);
	return result;
}

// Some iterables are stateful, e.g. generators. We need to iterate them first.
function arrify<T>(iterable: Iterable<T>): Array<T> {
	if (Array.isArray(iterable)) {
		return iterable;
	}

	return [...iterable];
}

// We use imperative code as it faster than functional code because it does not
// create extra arrays. We try re-use and mutate arrays as much as possible.
// We need to make sure callers parameters are not mutated though.
function iterate<T>(arrays: T[][], result: T[][], values: T[], index: number) {
	if (index === arrays.length) {
		result.push(values.slice());
		return;
	}

	for (let value of arrays[index]) {
		values.push(value);
		iterate(arrays, result, values, index + 1);
		values.pop();
	}
}
