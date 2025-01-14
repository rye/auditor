from typing import Dict, Any, Optional, TYPE_CHECKING
import attr
import logging
import decimal

from .area_enums import AreaStatus, AreaType
from .clausable import Clausable

if TYPE_CHECKING:
    from ..clause import SingleClause

logger = logging.getLogger(__name__)


@attr.s(cache_hash=True, slots=True, kw_only=True, frozen=True, auto_attribs=True)
class AreaPointer(Clausable):
    code: str
    status: AreaStatus
    kind: AreaType
    name: str
    degree: str
    dept: Optional[str]
    gpa: Optional[decimal.Decimal]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "area",
            "code": self.code,
            "status": self.status.name,
            "kind": self.kind.name,
            "degree": self.degree,
            "dept": self.dept,
            "name": self.name,
        }

    @staticmethod
    def from_dict(data: Dict) -> 'AreaPointer':
        return AreaPointer(
            code=data['code'],
            status=AreaStatus(data['status']),
            kind=AreaType(data['kind']),
            name=data['name'],
            degree=data['degree'],
            gpa=decimal.Decimal(data['gpa']) if 'gpa' in data else None,
            dept=data.get('dept', None),
        )

    def apply_single_clause(self, clause: 'SingleClause') -> bool:  # noqa: C901
        if clause.key == 'code':
            return clause.compare(self.code)

        if clause.key == 'status':
            return clause.compare(self.status.name)

        if clause.key in ('kind', 'type'):
            return clause.compare(self.kind.name)

        if clause.key == 'name':
            return clause.compare(self.name)

        if clause.key == 'degree':
            return clause.compare(self.degree)

        if clause.key == 'gpa':
            if self.gpa is not None:
                return clause.compare(self.gpa)
            else:
                return False

        raise TypeError(f"expected got unknown key {clause.key}")
