from dataclasses import dataclass
from typing import Dict, List, Iterator, TYPE_CHECKING
import re
import logging

from ..base import Rule, BaseCourseRule
from ..constants import Constants
from ..lib import str_to_grade_points
from ..solution.course import CourseSolution

if TYPE_CHECKING:
    from ..context import RequirementContext

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CourseRule(Rule, BaseCourseRule):
    __slots__ = ()

    @staticmethod
    def can_load(data: Dict) -> bool:
        if "course" in data:
            return True
        return False

    @staticmethod
    def load(data: Dict, *, c: Constants, path: List[str]) -> 'CourseRule':
        course = data['course']
        min_grade = data.get('grade', None)

        path = [*path, f"*{course}" + (f"(grade >= {min_grade})" if min_grade is not None else "")]

        return CourseRule(
            course=course,
            hidden=data.get("hidden", False),
            grade=str_to_grade_points(min_grade) if min_grade is not None else None,
            allow_claimed=data.get("including claimed", False),
            path=tuple(path),
        )

    def validate(self, *, ctx: 'RequirementContext') -> None:
        method_a = re.match(r"[A-Z]{3,5} [0-9]{3}", self.course)
        method_b = re.match(r"[A-Z]{2}/[A-Z]{2} [0-9]{3}", self.course)
        method_c = re.match(r"(IS|ID) [0-9]{3}", self.course)

        assert (method_a or method_b or method_c) is not None, f"{self.course}, {method_a}, {method_b}, {method_c}"

    def solutions(self, *, ctx: 'RequirementContext') -> Iterator[CourseSolution]:
        exception = ctx.get_exception(self.path)
        if exception and exception.is_pass_override():
            logger.debug("forced override on %s", self.path)
            yield CourseSolution.from_rule(rule=self, overridden=True)
            return

        logger.debug('%s reference to course "%s"', self.path, self.course)

        yield CourseSolution.from_rule(rule=self)

    def estimate(self, *, ctx: 'RequirementContext') -> int:
        logger.debug('CourseRule.estimate: 1')
        return 1

    def has_potential(self, *, ctx: 'RequirementContext') -> bool:
        return True
        if self._has_potential(ctx=ctx):
            logger.debug('%s has potential: yes', self.path)
            return True
        else:
            logger.debug('%s has potential: no', self.path)
            return False

    def _has_potential(self, *, ctx: 'RequirementContext') -> bool:
        if ctx.get_exception(self.path) is not None:
            return True

        if ctx.find_course(self.course) is not None:
            return True

        return False
