use super::*;

/// Every variable name in the project against every managed file, with only presence and
/// equality. Desktop-only: the broker never exposes it (ADR-0043).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ValueComparison {
    pub files: Vec<String>,
    pub rows: Vec<ValueComparisonRow>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ValueComparisonRow {
    pub key: String,
    /// One cell per entry in [`ValueComparison::files`], in the same order.
    pub cells: Vec<ValueComparisonCell>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "kebab-case")]
pub enum ValueComparisonCell {
    Missing,
    Empty,
    /// The key appears more than once, so no single value can be compared.
    Duplicate,
    /// The value could not be decoded, so it is not compared.
    Unreadable,
    /// Cells of one row with the same `group` hold equal values. Groups are numbered in
    /// file order for this response only. They are not fingerprints and are never stored.
    Present {
        group: u8,
    },
}

impl ProjectService {
    pub fn compare_values(&self) -> EnvResult<ValueComparison> {
        let manifest = ManifestStore::for_root(&self.root).load()?;
        let relatives = self.discover(&manifest)?;
        let mut files = Vec::with_capacity(relatives.len());
        let mut documents = Vec::with_capacity(relatives.len());
        for relative in &relatives {
            files.push(to_manifest_path(relative));
            documents.push(self.load_document(relative)?.document);
        }
        let keys = documents
            .iter()
            .flat_map(|document| {
                document
                    .assignments()
                    .into_iter()
                    .map(|assignment| assignment.key.to_owned())
                    .collect::<Vec<_>>()
            })
            .collect::<BTreeSet<_>>();
        let rows = keys
            .into_iter()
            .map(|key| {
                let cells = compare_key(&key, &documents);
                ValueComparisonRow { key, cells }
            })
            .collect();
        Ok(ValueComparison { files, rows })
    }
}

fn compare_key(key: &str, documents: &[Document]) -> Vec<ValueComparisonCell> {
    let mut distinct: Vec<Zeroizing<String>> = Vec::new();
    documents
        .iter()
        .map(|document| {
            let occurrences = document
                .assignments()
                .iter()
                .filter(|assignment| assignment.key == key)
                .count();
            match occurrences {
                0 => ValueComparisonCell::Missing,
                1 => match document.decoded_value(key) {
                    Ok(decoded) => {
                        let value = Zeroizing::new(decoded);
                        if value.is_empty() {
                            return ValueComparisonCell::Empty;
                        }
                        let index = distinct
                            .iter()
                            .position(|known| known.as_str() == value.as_str())
                            .unwrap_or_else(|| {
                                distinct.push(value);
                                distinct.len() - 1
                            });
                        ValueComparisonCell::Present {
                            group: u8::try_from(index).unwrap_or(u8::MAX),
                        }
                    }
                    Err(_) => ValueComparisonCell::Unreadable,
                },
                _ => ValueComparisonCell::Duplicate,
            }
        })
        .collect()
}
