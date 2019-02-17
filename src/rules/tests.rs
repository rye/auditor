use super::*;
use crate::audit::area_of_study::Semester;
use crate::traits::print::Print;
use std::collections::BTreeMap;

#[test]
fn deserialize_simple_course_in_array() {
	let data = "---
- STAT 214";

	let expected_struct = vec![Rule::Course(course::Rule {
		course: "STAT 214".to_string(),
		..Default::default()
	})];

	let deserialized: Vec<Rule> = serde_yaml::from_str(&data).unwrap();
	assert_eq!(deserialized, expected_struct);
}

#[test]
fn serialize() {
	let course_a = course::Rule {
		course: "ASIAN 101".to_string(),
		..Default::default()
	};
	let course_b = course::Rule {
		course: "ASIAN 101".to_string(),
		semester: Some(Semester::Fall),
		year: Some(2014),
		..Default::default()
	};
	let data = vec![
		Rule::Course(course_a.clone()),
		Rule::Course(course_b.clone()),
		Rule::Requirement(req_ref::Rule {
			requirement: "Name".to_string(),
			optional: true,
		}),
		Rule::CountOf(count_of::Rule {
			count: count_of::Counter::Number(1),
			of: vec![Rule::Course(course_a.clone())],
		}),
		Rule::Both(both::Rule {
			both: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Either(either::Rule {
			either: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Given(given::Rule {
			given: given::Given::AllCourses,
			what: given::What::Courses,
			filter: Some(BTreeMap::new()),
			limit: Some(vec![]),
			action: "count < 2".parse().unwrap(),
		}),
		Rule::Do(action_only::Rule {
			action: crate::action::LhsValueAction {
				lhs: crate::action::Value::String("a".to_string()),
				op: Some(crate::action::Operator::LessThan),
				rhs: Some(crate::action::Value::String("b".to_string())),
			},
		}),
	];

	let expected = r#"---
- course: ASIAN 101
- course: ASIAN 101
  section: ~
  year: 2014
  semester: Fall
  lab: ~
  can_match_used: ~
- requirement: Name
  optional: true
- count: 1
  of:
    - course: ASIAN 101
- both:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
      can_match_used: ~
- either:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
      can_match_used: ~
- given: courses
  limit: []
  where: {}
  what: courses
  do:
    lhs: Count
    op: LessThan
    rhs:
      Integer: 2
- do:
    lhs:
      String: a
    op: LessThan
    rhs:
      String: b"#;

	let actual = serde_yaml::to_string(&data).unwrap();
	assert_eq!(actual, expected, "actual: {}\n\nexpected: {}", actual, expected);
}

#[test]
fn deserialize() {
	let course_a = course::Rule {
		course: "ASIAN 101".to_string(),
		..Default::default()
	};
	let course_b = course::Rule {
		course: "ASIAN 101".to_string(),
		semester: Some(Semester::Fall),
		year: Some(2014),
		..Default::default()
	};
	let expected = vec![
		Rule::Course(course_a.clone()),
		Rule::Course(course_b.clone()),
		Rule::Requirement(req_ref::Rule {
			requirement: "Name".to_string(),
			optional: true,
		}),
		Rule::CountOf(count_of::Rule {
			count: count_of::Counter::Number(1),
			of: vec![Rule::Course(course_a.clone())],
		}),
		Rule::Both(both::Rule {
			both: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Either(either::Rule {
			either: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Given(given::Rule {
			given: given::Given::AllCourses,
			what: given::What::Courses,
			filter: Some(BTreeMap::new()),
			limit: Some(vec![]),
			action: "count < 2".parse().unwrap(),
		}),
		Rule::Do(action_only::Rule {
			action: crate::action::LhsValueAction {
				lhs: crate::action::Value::String("a".to_string()),
				op: Some(crate::action::Operator::LessThan),
				rhs: Some(crate::action::Value::String("b".to_string())),
			},
		}),
	];

	let data = r#"---
- course: ASIAN 101
- course: ASIAN 101
  section: ~
  year: 2014
  semester: Fall
  lab: ~
- requirement: Name
  optional: true
- count: 1
  of:
    - course: ASIAN 101
- both:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
- either:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
- given: courses
  what: courses
  where: {}
  limit: []
  do: count < 2
- do: {lhs: a, op: <, rhs: b}"#;

	let actual: Vec<Rule> = serde_yaml::from_str(&data).unwrap();
	assert_eq!(actual, expected);

	let data = r#"---
- course: ASIAN 101
- course: ASIAN 101
  section: ~
  year: 2014
  semester: Fall
  lab: ~
- requirement: Name
  optional: true
- count: 1
  of:
    - course: ASIAN 101
- both:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
- either:
    - course: ASIAN 101
    - course: ASIAN 101
      section: ~
      year: 2014
      semester: Fall
      lab: ~
- given: courses
  what: courses
  where: {}
  limit: []
  do: count < 2
- do: {lhs: a, op: <, rhs: b}"#;

	let actual: Vec<Rule> = serde_yaml::from_str(&data).unwrap();
	assert_eq!(actual, expected);
}

#[test]
fn deserialize_shorthands() {
	let data = r#"---
- ASIAN 101
- course: ASIAN 101
- {course: ASIAN 102, year: 2014, semester: Fall}
- requirement: Name 1
- {requirement: Name 2, optional: true}
- count: 1
  of:
    - ASIAN 101
- both:
    - ASIAN 101
    - {course: ASIAN 102, year: 2014, semester: Fall}
- either:
    - ASIAN 101
    - {course: ASIAN 102, year: 2014, semester: Fall}
- given: courses
  what: courses
  do: count < 2
- do: {lhs: a, op: <, rhs: b}"#;

	let course_a = course::Rule {
		course: "ASIAN 101".to_string(),
		..Default::default()
	};
	let course_b = course::Rule {
		course: "ASIAN 102".to_string(),
		semester: Some(Semester::Fall),
		year: Some(2014),
		..Default::default()
	};
	let expected = vec![
		Rule::Course(course_a.clone()),
		Rule::Course(course_a.clone()),
		Rule::Course(course_b.clone()),
		Rule::Requirement(req_ref::Rule {
			requirement: "Name 1".to_string(),
			optional: false,
		}),
		Rule::Requirement(req_ref::Rule {
			requirement: "Name 2".to_string(),
			optional: true,
		}),
		Rule::CountOf(count_of::Rule {
			count: count_of::Counter::Number(1),
			of: vec![Rule::Course(course_a.clone())],
		}),
		Rule::Both(both::Rule {
			both: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Either(either::Rule {
			either: (
				Box::new(Rule::Course(course_a.clone())),
				Box::new(Rule::Course(course_b.clone())),
			),
		}),
		Rule::Given(given::Rule {
			given: given::Given::AllCourses,
			what: given::What::Courses,
			filter: None,
			limit: None,
			action: "count < 2".parse().unwrap(),
		}),
		Rule::Do(action_only::Rule {
			action: crate::action::LhsValueAction {
				lhs: crate::action::Value::String("a".to_string()),
				op: Some(crate::action::Operator::LessThan),
				rhs: Some(crate::action::Value::String("b".to_string())),
			},
		}),
	];

	let actual: Vec<Rule> = serde_yaml::from_str(&data).unwrap();
	assert_eq!(actual, expected);
}

#[test]
fn pretty_print() {
	let data = r#"---
- ASIAN 101
- course: ASIAN 101
- {course: ASIAN 102, year: 2014, semester: Fall}
- requirement: Name 1
- {requirement: Name 2, optional: true}
- {count: 1, of: [ASIAN 101]}
- {both: [ASIAN 101, {course: ASIAN 102, year: 2014, semester: Fall}]}
- {either: [ASIAN 101, {course: ASIAN 102, year: 2014, semester: Fall}]}
- {given: courses, what: courses, do: count < 2}
- {do: {lhs: X, op: <, rhs: Y}}
"#;

	let actual: Vec<Rule> = serde_yaml::from_str(&data).unwrap();
	let actual: Vec<String> = actual
		.into_iter()
		.filter_map(|r| match r.print() {
			Ok(p) => Some(p),
			Err(_) => None,
		})
		.collect();

	let expected = vec![
		"take ASIAN 101",
		"take ASIAN 101",
		"take ASIAN 102 (Fall 2014)",
		"complete the “Name 1” requirement",
		"complete the “Name 2” (optional) requirement",
		"take ASIAN 101",
		"take both ASIAN 101 and ASIAN 102 (Fall 2014)",
		"take either ASIAN 101 or ASIAN 102 (Fall 2014)",
		"have fewer than two courses",
		"ensure that the computed result of the subset “X” is less than the computed result of the subset “Y”",
	];

	assert_eq!(actual, expected, "left: {:#?}\n\nright: {:#?}", actual, expected);
}

#[test]
fn dance_seminar() {
	let expected = Rule::Given(given::Rule {
		given: given::Given::NamedVariable {
			save: "Senior Dance Seminars".to_string(),
		},
		what: given::What::Courses,
		filter: None,
		limit: None,
		action: "count >= 1".parse().unwrap(),
	});

	let data = r#"---
given: save
save: "Senior Dance Seminars"
what: courses
do: count >= 1
"#;

	let actual: Rule = serde_yaml::from_str(&data).unwrap();
	assert_eq!(actual, expected);

	let data = r#"---
given: save
save: "Senior Dance Seminars"
what: courses
do:
  lhs: Count
  op: GreaterThanEqualTo
  rhs:
    Integer: 1
"#;

	let actual: Rule = serde_yaml::from_str(&data).unwrap();
	assert_eq!(actual, expected);
}
