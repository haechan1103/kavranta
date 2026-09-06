use super::*;

impl ProjectService {
    pub fn rename_env_file(
        &self,
        request: RenameEnvFileRequest,
    ) -> EnvResult<RenameEnvFileSummary> {
        let source_relative = PathBuf::from(&request.file);
        let new_name = validate_new_env_file_name(&request.new_name)?;
        let store = ManifestStore::for_root(&self.root);
        let manifest = store.load()?;

        if !self
            .discover(&manifest)?
            .iter()
            .any(|path| path == &source_relative)
        {
            return Err(EnvError::invalid(
                "관리 중인 환경 파일만 실제 이름을 변경할 수 있습니다.",
            ));
        }

        if source_relative.file_name().and_then(|name| name.to_str()) == Some(new_name) {
            return Err(EnvError::invalid("현재 파일명과 다른 이름을 입력해주세요."));
        }

        let target_relative = source_relative
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .join(new_name);
        let mut options = DiscoveryOptions::default();
        options
            .ignored_files
            .extend(manifest.scan.ignored_files.iter().cloned());
        options
            .ignored_directories
            .extend(manifest.scan.ignored_directories.iter().cloned());

        let source_target = safe_existing_target(&self.root, &source_relative)?;
        let target = safe_new_env_target(&self.root, &target_relative, &options)?;
        let loaded = self.load_document(&source_relative)?;

        fs::hard_link(&source_target, &target)
            .map_err(|error| EnvError::io(&target_relative, error))?;

        let linked_bytes = match fs::read(&target) {
            Ok(bytes) => bytes,
            Err(error) => {
                let _ = fs::remove_file(&target);
                return Err(EnvError::io(&target_relative, error));
            }
        };
        if FileRevision::from_bytes(&linked_bytes) != loaded.revision {
            let _ = fs::remove_file(&target);
            return Err(EnvError::changed_externally(&source_relative));
        }

        let old_file = to_manifest_path(&source_relative);
        let new_file = to_manifest_path(&target_relative);
        let mut updated_manifest = manifest.clone();
        for link in &mut updated_manifest.links {
            for member in &mut link.members {
                if member.file == old_file {
                    member.file.clone_from(&new_file);
                }
            }
        }
        if let Some(label) = updated_manifest.file_labels.remove(&old_file) {
            updated_manifest.file_labels.insert(new_file.clone(), label);
        }

        if let Err(error) = store.save(&updated_manifest) {
            let _ = fs::remove_file(&target);
            return Err(error);
        }

        if let Err(remove_error) = fs::remove_file(&source_target) {
            let manifest_rollback = store.save(&manifest);
            let target_rollback = fs::remove_file(&target);
            if manifest_rollback.is_err() || target_rollback.is_err() {
                return Err(EnvError::transaction(
                    "환경 파일명 변경과 복구가 완전하지 않을 수 있습니다.",
                ));
            }
            return Err(EnvError::io(&source_relative, remove_error));
        }

        Ok(RenameEnvFileSummary { old_file, new_file })
    }
}

fn validate_new_env_file_name(name: &str) -> EnvResult<&str> {
    if name.is_empty()
        || name.chars().count() > 120
        || name.trim() != name
        || name.contains(['/', '\\'])
        || name.chars().any(char::is_control)
    {
        return Err(EnvError::invalid("실제 파일명이 올바르지 않습니다."));
    }
    let path = Path::new(name);
    if path.components().count() != 1
        || !matches!(
            path.components().next(),
            Some(std::path::Component::Normal(_))
        )
        || !is_env_candidate(name)
    {
        return Err(EnvError::invalid(
            "지원되는 환경 파일명을 입력해주세요. 예제 파일 이름은 사용할 수 없습니다.",
        ));
    }
    Ok(name)
}

#[cfg(test)]
mod tests {
    use env_test_support::SyntheticProject;

    use super::*;

    fn hidden_env_name(suffix: &str) -> String {
        [".", "en", "v", suffix].concat()
    }

    #[test]
    fn renames_a_managed_file_and_updates_link_members_without_changing_bytes() {
        let project = SyntheticProject::new();
        let source = hidden_env_name(".local");
        let target_name = hidden_env_name(".development");
        let peer = hidden_env_name(".test");
        let original = b"API_KEY=fake_test_key_123\n";
        project.write(&source, std::str::from_utf8(original).unwrap_or_default());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            fs::set_permissions(
                project.root().join(&source),
                fs::Permissions::from_mode(0o640),
            )
            .expect("fixture permissions");
        }
        project.write(&peer, "API_KEY=fake_peer_key_456\n");
        let service = ProjectService::open(project.root()).expect("service");
        service.initialize().expect("initialize");
        let store = ManifestStore::for_root(project.root());
        let mut manifest = store.load().expect("manifest");
        manifest.links.push(LinkGroup {
            id: "link-api".to_owned(),
            key: "API_KEY".to_owned(),
            members: vec![
                LinkMember {
                    file: source.clone(),
                },
                LinkMember { file: peer },
            ],
        });
        store.save(&manifest).expect("save link");

        let summary = service
            .rename_env_file(RenameEnvFileRequest {
                file: source.clone(),
                new_name: target_name.clone(),
            })
            .expect("rename");

        assert_eq!(summary.old_file, source);
        assert_eq!(summary.new_file, target_name);
        assert!(!project.root().join(&summary.old_file).exists());
        assert_eq!(
            fs::read(project.root().join(&summary.new_file)).expect("renamed bytes"),
            original
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let permissions = fs::metadata(project.root().join(&summary.new_file))
                .expect("renamed metadata")
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(permissions, 0o640);
        }
        let updated = store.load().expect("updated manifest");
        assert!(
            updated.links[0]
                .members
                .iter()
                .any(|member| member.file == summary.new_file)
        );
        assert!(
            !updated.links[0]
                .members
                .iter()
                .any(|member| member.file == summary.old_file)
        );
    }

    #[test]
    fn rejects_existing_unsupported_and_nested_targets() {
        let project = SyntheticProject::new();
        let source = hidden_env_name(".local");
        let existing = hidden_env_name(".test");
        project.write(&source, "PORT=fake_3000\n");
        project.write(&existing, "PORT=fake_4000\n");
        let service = ProjectService::open(project.root()).expect("service");
        service.initialize().expect("initialize");

        for new_name in [
            existing,
            "notes.txt".to_owned(),
            "nested/file.env".to_owned(),
        ] {
            assert!(
                service
                    .rename_env_file(RenameEnvFileRequest {
                        file: source.clone(),
                        new_name,
                    })
                    .is_err()
            );
            assert!(project.root().join(&source).exists());
        }
    }
}
