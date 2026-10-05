use super::*;
use crate::DeploymentTarget;
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

    /// Record where this project deploys. Stores destination metadata only, replacing any
    /// existing target for the same provider so a corrected destination does not
    /// accumulate. Caller-side validation against the provider catalog happens before this,
    /// in `env-provider`, so `env-core` stays independent of provider catalogs.
    /// The recorded destination for one provider, when it is unambiguous.
    ///
    /// `Ok(None)` means nothing is recorded. `Err` means more than one target exists for
    /// that provider, so the caller must choose instead of the app picking one. Provider
    /// knowledge stays out of `env-core`: this only reads recorded configuration.
    pub fn recorded_deployment_target(
        &self,
        provider: &str,
    ) -> EnvResult<Option<DeploymentTarget>> {
        let manifest = ManifestStore::for_root(&self.root).load()?;
        let mut matching = manifest
            .deployment
            .targets
            .iter()
            .filter(|target| target.provider == provider);
        let Some(first) = matching.next() else {
            return Ok(None);
        };
        if matching.next().is_some() {
            return Err(crate::EnvError::invalid(
                "이 프로젝트에 같은 provider의 배포 대상이 여러 개라 어느 대상인지 지정해주세요.",
            ));
        }
        Ok(Some(first.clone()))
    }

    pub fn record_deployment_target(&self, target: DeploymentTarget) -> EnvResult<MutationSummary> {
        let store = ManifestStore::for_root(&self.root);
        let mut manifest = store.load()?;
        let provider = target.provider.clone();
        manifest
            .deployment
            .targets
            .retain(|existing| existing.provider != provider);
        manifest.deployment.targets.push(target);
        store.save(&manifest)?;
        Ok(MutationSummary {
            affected_files: Vec::new(),
            keys: Vec::new(),
        })
    }

    /// Reads one local image attached to a variable guide, when both exist.
    /// Attachments are never projected; the desktop UI reads them directly.
    pub fn guide_attachment(
        &self,
        key: &str,
        file: &str,
    ) -> EnvResult<Option<guide::GuideAttachment>> {
        let manifest = ManifestStore::for_root(&self.root).load()?;
        if !manifest.guides.contains_key(key) {
            return Ok(None);
        }
        guide::read_guide_attachment(&self.root, key, file)
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
