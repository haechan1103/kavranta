use super::*;

impl AppRuntime {
    pub fn scan(&self, project_id: &str) -> EnvResult<env_core::ProjectProjection> {
        self.refresh_registry()?;
        let (root, file_labels) = {
            let registry = self
                .registry
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let project = registry
                .projects
                .iter()
                .find(|project| project.id == project_id)
                .ok_or_else(|| EnvError::unregistered_project(project_id))?;
            (project.root.clone(), project.file_labels.clone())
        };
        let mut projection =
            ProjectService::open(root)?.initialize_with_file_labels(&file_labels)?;
        if let Ok(activity) = self.agent_activity(project_id) {
            let requested_keys = activity
                .into_iter()
                .filter(|event| event.category == "value-read" && event.outcome == "blocked")
                .flat_map(|event| event.variable_names)
                .collect::<BTreeSet<_>>();
            for item in &mut projection.classification_review {
                if item.classified_by == ClassificationSource::Heuristic
                    && requested_keys.contains(&item.key)
                    && !item
                        .review_reasons
                        .contains(&ClassificationReviewReason::AgentAccessRequest)
                {
                    item.review_reasons
                        .push(ClassificationReviewReason::AgentAccessRequest);
                }
            }
            projection.access_review_count = projection
                .classification_review
                .iter()
                .filter(|item| !item.review_reasons.is_empty())
                .count();
        }
        Ok(projection)
    }

    pub fn rename_file_label(&self, project_id: &str, file: &str, name: &str) -> EnvResult<()> {
        env_core::validate_display_name(name)?;
        let service = self.service(project_id)?;
        let path = service.validate_file_for_display_name(file)?;
        self.update_registry(|registry| {
            let project = registry
                .projects
                .iter_mut()
                .find(|project| project.id == project_id)
                .ok_or_else(|| EnvError::unregistered_project(project_id))?;
            project.file_labels.insert(path, name.trim().to_owned());
            Ok(())
        })
    }

    pub fn rename_file_on_disk(
        &self,
        project_id: &str,
        file: &str,
        new_name: &str,
    ) -> EnvResult<RenameEnvFileSummary> {
        let service = self.service(project_id)?;
        let summary = service.rename_env_file(RenameEnvFileRequest {
            file: file.to_owned(),
            new_name: new_name.to_owned(),
        })?;
        let registry_update = self.update_registry(|registry| {
            let project = registry
                .projects
                .iter_mut()
                .find(|project| project.id == project_id)
                .ok_or_else(|| EnvError::unregistered_project(project_id))?;
            move_file_label(project, &summary.old_file, &summary.new_file);
            Ok(())
        });
        if let Err(registry_error) = registry_update {
            let old_name = Path::new(&summary.old_file)
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| EnvError::invalid("이전 실제 파일명을 복구할 수 없습니다."))?;
            if service
                .rename_env_file(RenameEnvFileRequest {
                    file: summary.new_file.clone(),
                    new_name: old_name.to_owned(),
                })
                .is_err()
            {
                return Err(EnvError::transaction(
                    "실제 파일명은 변경됐지만 로컬 표시 이름 참조를 갱신하지 못했습니다.",
                ));
            }
            return Err(registry_error);
        }
        Ok(summary)
    }

    pub fn agent_activity(&self, project_id: &str) -> EnvResult<Vec<AgentActivityEvent>> {
        // Resolve through the registration first so arbitrary file names cannot be requested.
        let service = self.service(project_id)?;
        Ok(agent_activity::load_agent_activity(
            &self.audit_dir,
            &std::env::temp_dir().join("env-manager-audit"),
            service.project_id(),
        ))
    }

    pub fn provider_push_receipts(&self, project_id: &str) -> EnvResult<Vec<ProviderPushReceipt>> {
        let _ = self.root(project_id)?;
        self.refresh_registry()?;
        let registry = self
            .registry
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        Ok(registry
            .provider_push_receipts
            .iter()
            .filter(|receipt| receipt.project_id == project_id)
            .take(100)
            .cloned()
            .collect())
    }

    pub fn record_provider_push(&self, receipt: ProviderPushReceipt) -> EnvResult<()> {
        let _ = self.root(&receipt.project_id)?;
        self.update_registry(|registry| {
            registry.provider_push_receipts.insert(0, receipt);
            registry.provider_push_receipts.truncate(500);
            Ok(())
        })
    }
}

fn move_file_label(project: &mut ProjectRegistration, old_file: &str, new_file: &str) {
    let label = project.file_labels.remove(old_file);
    project.file_labels.remove(new_file);
    if let Some(label) = label {
        project.file_labels.insert(new_file.to_owned(), label);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_a_local_display_label_to_the_renamed_path() {
        let mut project = ProjectRegistration {
            id: "project".to_owned(),
            name: "Project".to_owned(),
            display_path: "/fake/project".to_owned(),
            root: PathBuf::from("/fake/project"),
            file_labels: BTreeMap::from([("old".to_owned(), "Local".to_owned())]),
        };

        move_file_label(&mut project, "old", "new");

        assert!(!project.file_labels.contains_key("old"));
        assert_eq!(
            project.file_labels.get("new").map(String::as_str),
            Some("Local")
        );
    }
}
