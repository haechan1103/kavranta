use super::*;
use crate::guide;

impl ProjectService {
    /// Reads the value-free markdown guide for one variable, when one exists.
    pub fn variable_guide(&self, key: &str) -> EnvResult<Option<String>> {
        let manifest = ManifestStore::for_root(&self.root).load()?;
        if !manifest.guides.contains_key(key) {
            return Ok(None);
        }
        guide::read_guide(&self.root, key)
    }

    /// Writes or replaces the value-free markdown guide for one variable.
    pub fn save_variable_guide(&self, key: &str, markdown: &str) -> EnvResult<MutationSummary> {
        let store = ManifestStore::for_root(&self.root);
        let mut manifest = store.load()?;
        let relative = guide::write_guide(&self.root, key, markdown)?;
        manifest.guides.insert(key.to_owned(), relative);
        store.save(&manifest)?;
        Ok(MutationSummary {
            affected_files: Vec::new(),
            keys: vec![key.to_owned()],
        })
    }

    /// Removes the guide for one variable and its manifest pointer.
    pub fn remove_variable_guide(&self, key: &str) -> EnvResult<MutationSummary> {
        let store = ManifestStore::for_root(&self.root);
        let mut manifest = store.load()?;
        if manifest.guides.remove(key).is_some() {
            guide::remove_guide(&self.root, key)?;
            store.save(&manifest)?;
        }
        Ok(MutationSummary {
            affected_files: Vec::new(),
            keys: vec![key.to_owned()],
        })
    }
}
