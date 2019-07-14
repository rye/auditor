import glob
import json
import sys
import time
import datetime
import argparse

import yaml

from degreepath import CourseInstance, AreaOfStudy


def main():
    data = yaml.load(stream=sys.stdin, Loader=yaml.SafeLoader)

    area_def = data['area']
    student = data['student']

    transcript = []
    for row in student["courses"]:
        instance = CourseInstance.from_dict(**row)
        if instance:
            transcript.append(instance)
        else:
            print("error loading course into transcript", row, file=sys.stderr)

    print(f"auditing #{student['stnum']} for {area_def['name']}", file=sys.stderr)

    area = AreaOfStudy.load(area_def)
    area.validate()

    this_transcript = []
    attributes_to_attach = area.attributes.get("courses", {})
    for c in transcript:
        attrs_by_course = attributes_to_attach.get(c.course(), [])
        attrs_by_shorthand = attributes_to_attach.get(c.course_shorthand(), [])

        c = c.attach_attrs(attributes=attrs_by_course or attrs_by_shorthand)
        this_transcript.append(c)

    best_sol = None
    for sol in area.solutions(transcript=this_transcript):
        result = sol.audit(transcript=this_transcript)

        if best_sol is None:
            best_sol = result

        if result.rank() > best_sol.rank():
            best_sol = result

        if result.ok():
            break

    if best_sol is None:
        print("no audits completed", file=sys.stderr)
    else:
        print(best_sol)


if __name__ == "__main__":
    main()
