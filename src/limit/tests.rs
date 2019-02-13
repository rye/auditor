use super::Limiter;
use crate::filter;
use crate::value::WrappedValue;
use maplit::btreemap;

#[test]
fn serialize_level100() {
	let clause: filter::Clause = btreemap! {
		"level".into() => "100".parse::<WrappedValue>().unwrap(),
	};

	let data = Limiter {
		filter: clause,
		at_most: 2,
	};

	let expected = r#"---
where:
  level:
    Single:
      EqualTo:
        Integer: 100
at_most: 2"#;

	let actual = serde_yaml::to_string(&data).unwrap();

	assert_eq!(actual, expected);
}

#[test]
fn serialize_not_math() {
	let clause: filter::Clause = btreemap! {
		"department".into() => "! MATH".parse::<WrappedValue>().unwrap(),
	};

	let data = Limiter {
		filter: clause,
		at_most: 2,
	};

	let expected = r#"---
where:
  department:
    Single:
      NotEqualTo:
        String: MATH
at_most: 2"#;

	let actual = serde_yaml::to_string(&data).unwrap();

	assert_eq!(actual, expected);
}

#[test]
fn deserialize_level100() {
	let clause: filter::Clause = btreemap! {
		"level".into() => "100".parse::<WrappedValue>().unwrap(),
	};

	let expected = Limiter {
		filter: clause,
		at_most: 2,
	};

	let data = r#"---
where:
  level: "100"
at_most: 2"#;

	let actual: Limiter = serde_yaml::from_str(&data).unwrap();

	assert_eq!(actual, expected);
}