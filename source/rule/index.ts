import { CountRule } from "./count";
import { CourseRule } from "./course";
import { FromRule } from "./from";
import { ReferenceRule } from "./reference";

import { Rule } from "./interface";

export { Rule, CountRule, CourseRule, FromRule, ReferenceRule };

export function loadRule(data: any): Rule {
	if (CourseRule.can_load(data)) {
		return CourseRule.load(data);
	} else if (FromRule.can_load(data)) {
		return new FromRule(data);
	} else if (CountRule.can_load(data)) {
		return CountRule.load(data);
	} else if (ReferenceRule.can_load(data)) {
		return ReferenceRule.load(data);
	}

	throw new TypeError(
		`expected Course, Given, Count, Both, Either, or Do; found none of those (${data})`,
	);
}
