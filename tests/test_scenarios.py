from degreepath import AreaOfStudy, Constants, AreaPointer
from degreepath.audit import audit
from degreepath.data.course import course_from_str
from degreepath.data.area_enums import AreaStatus, AreaType
from typing import Dict, Any


def test_audit__double_history_and_studio():
    student: Dict[str, Any] = {
        'areas': [
            AreaPointer(
                code='140',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Studio Art',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
            AreaPointer(
                code='135',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Art History',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
        ],
        'courses': [
            course_from_str('DEPT 123'),
        ],
    }

    c = Constants(matriculation_year=2000)

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History Test',
        'type': 'major',
        'code': '140',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 18


def test_audit__single_studio_art():
    student: Dict[str, Any] = {
        'areas': [
            AreaPointer(
                code='140',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Studio Art',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
        ],
        'courses': [
            course_from_str('DEPT 123'),
        ],
    }

    c = Constants(matriculation_year=2000)

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History Test',
        'type': 'major',
        'code': '140',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 21


def test_audit__single_art_history():
    student: Dict[str, Any] = {
        'areas': [
            AreaPointer(
                code='135',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Art History',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
        ],
        'courses': [
            course_from_str('DEPT 123'),
        ],
    }

    c = Constants(matriculation_year=2000)

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History Test',
        'type': 'major',
        'code': '135',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 21


def test_audit__double_art_history_and_other():
    student: Dict[str, Any] = {
        'areas': [
            AreaPointer(
                code='135',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Art History',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
            AreaPointer(
                code='001',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Other',
                degree='B.A.',
                dept='DEPT',
                gpa=None,
            ),
        ],
        'courses': [
            course_from_str('DEPT 123'),
        ],
    }

    c = Constants(matriculation_year=2000)

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History',
        'type': 'major',
        'code': '135',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 21


def test_audit__triple_arts_and_other():
    student: Dict[str, Any] = {
        'areas': [
            AreaPointer(
                code='135',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Art History',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
            AreaPointer(
                code='140',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Studio Art',
                degree='B.A.',
                dept='ART',
                gpa=None,
            ),
            AreaPointer(
                code='001',
                status=AreaStatus.Declared,
                kind=AreaType.Major,
                name='Other',
                degree='B.A.',
                dept='DEPT',
                gpa=None,
            ),
        ],
        'courses': [
            course_from_str('DEPT 123'),
        ],
    }

    c = Constants(matriculation_year=2000)

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History Test',
        'type': 'major',
        'code': '001',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 21

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Art History',
        'type': 'major',
        'code': '135',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 18

    area = AreaOfStudy.load(c=c, areas=student['areas'], transcript=student['courses'], specification={
        'name': 'Studio Art',
        'type': 'major',
        'code': '140',
        'degree': 'B.A.',

        'result': {
            'all': [{'course': 'DEPT 123'}],
        }
    })

    messages = list(audit(area=area, transcript=student['courses'], area_pointers=student['areas'], exceptions=[], print_all=False, estimate_only=False, constants=c))
    result = messages[-1].result

    assert result.result.items[-1].result.items[-1].result.assertions[0].assertion.expected == 18
