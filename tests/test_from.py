from degreepath import *
import pytest
import io
import yaml
import logging

c = Constants(matriculation_year=2000)


def test_from():
    test_data = io.StringIO("""
        result:
            from: {student: courses, repeats: first}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$gte: 1}}
    """)

    area = AreaOfStudy.load(specification=yaml.load(stream=test_data, Loader=yaml.SafeLoader), c=c)

    transcript = [
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20091),
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20081),
        CourseInstance.from_s("ASIAN 110"),
    ]

    s = next(area.solutions(transcript=transcript, areas=[]))
    a = s.audit(transcript=transcript, areas=[])

    assert len(a.successful_claims) == 1

    assert a.successful_claims[0].claim.clbid == transcript[1].clbid


def test_from_distinct():
    test_data = io.StringIO("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(distinct_courses): {$gte: 1}}
    """)

    area = AreaOfStudy.load(specification=yaml.load(stream=test_data, Loader=yaml.SafeLoader), c=c)

    transcript = [
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20091),
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20081),
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20071),
        CourseInstance.from_s("ASIAN 110"),
    ]

    s = next(area.solutions(transcript=transcript, areas=[]))
    a = s.audit(transcript=transcript, areas=[])

    assert len(a.successful_claims) == 1

    assert a.successful_claims[0].claim.clbid == transcript[0].clbid


def __get_data(spec):
    area = AreaOfStudy.load(specification=yaml.load(stream=io.StringIO(spec), Loader=yaml.SafeLoader), c=c)

    transcript = [
        CourseInstance.from_s("CSCI 111", gereqs=['SPM'], term=20091),
        CourseInstance.from_s("CSCI 112", gereqs=['SPM'], term=20081),
        CourseInstance.from_s("CSCI 113", gereqs=['SPM'], term=20071),
    ]

    return (area, transcript)


def test_solution_count_exact():
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$eq: 1}}
    """)

    solutions = area.solutions(transcript=transcript, areas=[])

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    with pytest.raises(StopIteration):
        next(solutions)


def test_solution_count_lessthan_3():
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$lt: 3}}
    """)

    count = sum(1 for _ in area.solutions(transcript=transcript, areas=[]))

    assert count == 7


def test_solution_count_lessthan_1():
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$lt: 1}}
    """)

    solutions = area.solutions(transcript=transcript, areas=[])

    sol = next(solutions)
    assert len(sol.solution.output) == 0

    with pytest.raises(StopIteration):
        next(solutions)


def test_solution_count_lessthanequal_1():
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$lte: 1}}
    """)

    solutions = area.solutions(transcript=transcript, areas=[])

    sol = next(solutions)
    assert len(sol.solution.output) == 0

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    sol = next(solutions)
    assert len(sol.solution.output) == 1

    with pytest.raises(StopIteration):
        next(solutions)


def test_solution_count_greaterthan_1(caplog):
    caplog.set_level(logging.DEBUG, logger='degreepath.rule.given.rule')
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: SPM}}
            assert: {count(courses): {$gt: 1}}
    """)

    solutions = area.solutions(transcript=transcript, areas=[])

    sol = next(solutions)
    assert len(sol.solution.output) == 2

    sol = next(solutions)
    assert len(sol.solution.output) == 2

    sol = next(solutions)
    assert len(sol.solution.output) == 2

    sol = next(solutions)
    assert len(sol.solution.output) == 3

    with pytest.raises(StopIteration):
        next(solutions)


def test_solution_count_always_yield_something(caplog):
    caplog.set_level(logging.DEBUG, logger='degreepath.rule.given.rule')
    area, transcript = __get_data("""
        result:
            from: {student: courses}
            where: {gereqs: {$eq: FOOBAR}}
            assert: {count(courses): {$gt: 1}}
    """)

    solutions = area.solutions(transcript=transcript, areas=[])

    sol = next(solutions)
    assert len(sol.solution.output) == 0

    with pytest.raises(StopIteration):
        next(solutions)
