from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Union, List, Optional, TYPE_CHECKING
import re
import itertools
import logging

if TYPE_CHECKING:
    from ...requirement import RequirementContext


@dataclass(frozen=True)
class FromInput:
    mode: str
    itemtype: str
    requirements: List[str]
    saves: List[str]

    def to_dict(self):
        return {
            "type": "from-input",
            "mode": self.mode,
            "itemtype": self.itemtype,
            "requirements": self.requirements,
            "saves": self.saves,
        }

    @staticmethod
    def load(data: Dict) -> FromInput:
        saves: List[str] = []
        requirements: List[str] = []

        if "student" in data:
            mode = "student"
            itemtype = data["student"]
        elif "saves" in data:
            mode = "saves"
            saves = data["saves"]
            itemtype = None
        elif "save" in data:
            mode = "saves"
            saves = [data["save"]]
            itemtype = None
        elif "requirements" in data:
            mode = "requirements"
            requirements = data["requirements"]
            itemtype = None
        elif "requirement" in data:
            mode = "requirements"
            requirements = [data["requirement"]]
            itemtype = None
        else:
            raise KeyError(
                f"expected student, saves, or requirements; got {list(data.keys())}"
            )

        return FromInput(
            mode=mode, itemtype=itemtype, requirements=requirements, saves=saves
        )

    def validate(self, *, ctx: RequirementContext):
        assert isinstance(self.mode, str)

        saves = ctx.save_rules
        requirements = ctx.requirements

        dbg = f"(when validating self={repr(self)}, saves={repr(saves)}, reqs={repr(requirements)})"

        if self.mode == "requirements":
            # TODO: assert that the result type of all mentioned requirements is the same
            if not self.requirements or not requirements:
                raise ValueError(
                    "expected self.requirements and args.requirements to be lists"
                )
            for name in self.requirements:
                assert isinstance(name, str), f"expected {name} to be a string"
                assert (
                    name in ctx.requirements
                ), f"expected to find '{name}' once, but could not find it {dbg}"

        elif self.mode == "saves":
            # TODO: assert that the result type of all mentioned saves is the same
            if not self.saves or not saves:
                raise ValueError("expected self.saves and args.saves to be lists")
            for name in self.saves:
                assert isinstance(name, str), f"expected {name} to be a string"
                assert (
                    name in ctx.save_rules
                ), f"expected to find '{name}' once, but could not find it {dbg}"

        elif self.mode == "student":
            assert self.itemtype in ["courses", "performances", "areas"]

        else:
            raise NameError(f"unknown 'from' type {self.mode}")