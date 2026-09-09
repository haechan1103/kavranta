use super::*;

impl ProjectService {
    /// Searches managed variable names without returning values or changing project state.
    ///
    /// Values are decoded only for uniquely named, matching occurrences so the caller can
    /// distinguish empty from present. The decoded buffer is zeroized before this method returns.
    pub fn search_redacted_variables(
        &self,
        query: &str,
        include_empty: bool,
    ) -> EnvResult<Vec<RedactedVariableMatch>> {
        if query.chars().count() > 80 || query.chars().any(char::is_control) {
            return Err(EnvError::invalid(
                "변수 검색어는 영문자 또는 숫자 두 자 이상, 80자 이하여야 합니다.",
            ));
        }
        let normalized_query = normalize_search_term(query);
        if normalized_query.len() < 2 {
            return Err(EnvError::invalid(
                "변수 검색어는 영문자 또는 숫자 두 자 이상이어야 합니다.",
            ));
        }

        let manifest = ManifestStore::for_root(&self.root).load()?;
        let mut matches = BTreeMap::<String, Vec<RedactedOccurrenceReference>>::new();
        for relative in self.discover(&manifest)? {
            let loaded = self.load_document(&relative)?;
            let mut matching_counts = BTreeMap::<String, usize>::new();
            for assignment in loaded.document.assignments() {
                if variable_match_rank(assignment.key, &normalized_query).is_some() {
                    *matching_counts
                        .entry(assignment.key.to_owned())
                        .or_default() += 1;
                }
            }

            for (key, count) in matching_counts {
                if count != 1 {
                    continue;
                }
                let value = Zeroizing::new(loaded.document.decoded_value(&key)?);
                let value_state = if value.is_empty() {
                    RedactedValueState::Empty
                } else {
                    RedactedValueState::Present
                };
                if include_empty || value_state == RedactedValueState::Present {
                    matches
                        .entry(key)
                        .or_default()
                        .push(RedactedOccurrenceReference {
                            file: to_manifest_path(&relative),
                            value_state,
                        });
                }
            }
        }

        let mut results = matches
            .into_iter()
            .map(|(key, occurrences)| RedactedVariableMatch {
                codex_access: manifest.access_for(&key),
                key,
                occurrences,
            })
            .collect::<Vec<_>>();
        results.sort_by(|left, right| {
            variable_match_rank(&left.key, &normalized_query)
                .cmp(&variable_match_rank(&right.key, &normalized_query))
                .then_with(|| left.key.cmp(&right.key))
        });
        Ok(results)
    }
}

fn normalize_search_term(value: &str) -> String {
    value
        .bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(|byte| byte.to_ascii_uppercase() as char)
        .collect()
}

fn variable_match_rank(key: &str, normalized_query: &str) -> Option<u8> {
    let normalized_key = normalize_search_term(key);
    if normalized_key == normalized_query {
        Some(0)
    } else if normalized_key.starts_with(normalized_query) {
        Some(1)
    } else if normalized_key.contains(normalized_query) {
        Some(2)
    } else {
        None
    }
}
