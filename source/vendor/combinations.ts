// The MIT License (MIT)
//
// Copyright (c) 2015 exromany
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// source: https://github.com/exromany/combinations-generator

export default function* combinations<T>(
	array: readonly T[] = [],
	count: number = 0,
) {
	let keys: number[] = [];
	let arrayLength = array.length;
	let index = 0;
	for (let i = 0; i < count; i++) {
		keys.push(-1);
	}

	while (index >= 0) {
		if (keys[index] < arrayLength - (count - index)) {
			for (let key = keys[index] - index + 1; index < count; index++) {
				keys[index] = key + index;
			}
			yield keys.map(c => array[c]);
		} else {
			index--;
		}
	}
}
