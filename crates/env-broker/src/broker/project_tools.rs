use super::super::*;

impl Broker {
    pub(super) fn find_registered_projects(
        &self,
        args: FindRegisteredProjectsArgs,
    ) -> Result<Value, EnvError> {
        let query = validated_project_query(&args.query)?;
        let limit = validated_limit(args.limit, 10, 25)?;
        let mut candidates = Vec::new();
        let mut unavailable_count = 0_usize;

        for registration in self.registered_projects()? {
            let Some(rank) = project_match_rank(&registration, &query) else {
                continue;
            };
            let Ok(service) = ProjectService::open(&registration.root) else {
                unavailable_count += 1;
                continue;
            };
            if registration.id != service.project_id()
                || !service.root().join(env_core::MANIFEST_FILE_NAME).is_file()
                || env_core::ManifestStore::for_root(service.root())
                    .load()
                    .is_err()
            {
                unavailable_count += 1;
                continue;
            }
            candidates.push((
                rank,
                RegisteredProjectCandidate {
                    project_id: service.project_id().to_owned(),
                    project_name: registration.name,
                    project_path: service.root().to_string_lossy().into_owned(),
                },
            ));
        }

        candidates.sort_by(|(left_rank, left), (right_rank, right)| {
            left_rank
                .cmp(right_rank)
                .then_with(|| {
                    left.project_name
                        .to_lowercase()
                        .cmp(&right.project_name.to_lowercase())
                })
                .then_with(|| left.project_id.cmp(&right.project_id))
        });
        let truncated = candidates.len() > limit;
        candidates.truncate(limit);
        let candidates = candidates
            .into_iter()
            .map(|(_, candidate)| candidate)
            .collect::<Vec<_>>();
        self.audit(
            "registry",
            "find_registered_projects",
            &[],
            &[],
            "redacted-project-lookup",
            "OK",
        );
        Ok(json!({
            "candidates": candidates,
            "unavailableCount": unavailable_count,
            "truncated": truncated
        }))
    }

    pub(super) fn search_registered_variable_sources(
        &self,
        args: SearchRegisteredVariableSourcesArgs,
    ) -> Result<Value, EnvError> {
        let normalized_query = validated_variable_query(&args.query)?;
        let limit = validated_limit(args.limit, 20, 50)?;
        let project_id = args
            .project_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if args.project_id.is_some()
            && project_id.is_none_or(|value| {
                value.chars().count() > 80 || value.chars().any(char::is_control)
            })
        {
            return Err(EnvError::invalid(
                "프로젝트 ID는 1~80자의 일반 문자여야 합니다.",
            ));
        }

        let mut candidates = Vec::new();
        let mut searched_project_count = 0_usize;
        let mut skipped_project_count = 0_usize;
        let mut scoped_registration_found = false;
        for registration in self.registered_projects()? {
            if project_id.is_some_and(|id| registration.id != id) {
                continue;
            }
            scoped_registration_found |= project_id.is_some();
            let Ok(service) = ProjectService::open(&registration.root) else {
                skipped_project_count += 1;
                continue;
            };
            if registration.id != service.project_id()
                || !service.root().join(env_core::MANIFEST_FILE_NAME).is_file()
            {
                skipped_project_count += 1;
                continue;
            }
            let Ok(matches) = service.search_redacted_variables(&args.query, args.include_empty)
            else {
                skipped_project_count += 1;
                continue;
            };
            searched_project_count += 1;
            for matched in matches {
                candidates.push(RegisteredVariableSourceCandidate {
                    project_id: service.project_id().to_owned(),
                    project_name: registration.name.clone(),
                    project_path: service.root().to_string_lossy().into_owned(),
                    key: matched.key,
                    codex_access: matched.codex_access,
                    occurrences: matched.occurrences,
                });
            }
        }
        if project_id.is_some() && !scoped_registration_found {
            return Err(EnvError::unregistered_project(
                project_id.unwrap_or_default(),
            ));
        }

        candidates.sort_by(|left, right| {
            variable_match_rank(&left.key, &normalized_query)
                .cmp(&variable_match_rank(&right.key, &normalized_query))
                .then_with(|| {
                    left.project_name
                        .to_lowercase()
                        .cmp(&right.project_name.to_lowercase())
                })
                .then_with(|| left.key.cmp(&right.key))
                .then_with(|| left.project_id.cmp(&right.project_id))
        });
        let truncated = candidates.len() > limit;
        candidates.truncate(limit);
        let matched_keys = candidates
            .iter()
            .map(|candidate| candidate.key.clone())
            .collect::<Vec<_>>();
        self.audit(
            project_id.unwrap_or("registry"),
            "search_registered_variable_sources",
            &[],
            &matched_keys,
            "redacted-cross-project-search",
            "OK",
        );
        Ok(json!({
            "candidates": candidates,
            "searchedProjectCount": searched_project_count,
            "skippedProjectCount": skipped_project_count,
            "truncated": truncated
        }))
    }

    pub(super) fn plan_register_current_project(
        &self,
        _args: PlanRegisterProjectArgs,
    ) -> Result<Value, EnvError> {
        let service = self.open_current_workspace_candidate()?;
        if self.is_registered_root(service.root())?
            && service.root().join(env_core::MANIFEST_FILE_NAME).is_file()
        {
            return Err(EnvError::invalid(
                "현재 작업 프로젝트는 이미 Kavranta에 등록되고 초기화되어 있습니다.",
            ));
        }
        self.store_plan(
            &service,
            PlannedOperation::RegisterProject,
            format!(
                "현재 작업 프로젝트 {}을(를) Kavranta에 등록하고 값 없이 구조를 초기화합니다.",
                service.root().display()
            ),
            Vec::new(),
            Vec::new(),
            "local-project-registration",
            None,
        )
    }

    pub(super) fn inspect(&self, args: InspectArgs) -> Result<Value, EnvError> {
        let service = self.open_registered(&args.project_path)?;
        let projection = service.scan()?;
        let result = serde_json::to_value(projection).map_err(EnvError::serialization)?;
        self.audit(
            service.project_id(),
            "inspect_project",
            &[],
            &[],
            "redacted",
            "OK",
        );
        Ok(result)
    }

    pub(super) fn find_reusable_variable_sources(
        &self,
        args: FindReusableVariableArgs,
    ) -> Result<Value, EnvError> {
        let target = self.open_registered(&args.project_path)?;
        let mut candidates = Vec::new();
        for registration in self.registered_projects()? {
            let Ok(service) = ProjectService::open(&registration.root) else {
                continue;
            };
            if service.project_id() == target.project_id()
                || !service.root().join(env_core::MANIFEST_FILE_NAME).is_file()
            {
                continue;
            }
            let Ok(occurrences) = service.redacted_occurrences(&args.key) else {
                continue;
            };
            let files = occurrences
                .into_iter()
                .filter(|occurrence| occurrence.value_state == RedactedValueState::Present)
                .map(|occurrence| occurrence.file)
                .collect::<Vec<_>>();
            if files.is_empty() {
                continue;
            }
            candidates.push(ReusableVariableCandidate {
                project_id: service.project_id().to_owned(),
                project_name: registration.name,
                display_path: registration.display_path,
                files,
            });
        }
        candidates.sort_by(|left, right| {
            left.project_name
                .to_ascii_lowercase()
                .cmp(&right.project_name.to_ascii_lowercase())
                .then_with(|| left.project_id.cmp(&right.project_id))
        });
        self.audit(
            target.project_id(),
            "find_reusable_variable_sources",
            &[],
            std::slice::from_ref(&args.key),
            "redacted-cross-project-search",
            "OK",
        );
        Ok(json!({ "candidates": candidates }))
    }

    pub(super) fn plan_copy_variable_from_project(
        &self,
        args: PlanOpaqueProjectCopyArgs,
    ) -> Result<Value, EnvError> {
        let target = self.open_registered(&args.project_path)?;
        let source = self.open_registered_project_id(&args.source_project_id)?;
        if source.project_id() == target.project_id() {
            return Err(EnvError::invalid(
                "같은 프로젝트 안에서는 기존 연결 또는 값 편집 기능을 사용해주세요.",
            ));
        }
        let source_available =
            source
                .redacted_occurrences(&args.key)?
                .into_iter()
                .any(|occurrence| {
                    occurrence.file == args.source_file
                        && occurrence.value_state == RedactedValueState::Present
                });
        if !source_available {
            return Err(EnvError::invalid(format!(
                "선택한 원본에 값이 있는 {} 변수를 찾지 못했습니다.",
                args.key
            )));
        }
        let affected_files = target.opaque_copy_impact(&args.target_file, &args.key)?;
        let request = OpaqueValueCopyRequest {
            source_file: args.source_file,
            target_file: args.target_file,
            key: args.key.clone(),
        };
        self.store_plan(
            &target,
            PlannedOperation::OpaqueProjectCopy {
                source_root: source.root().to_path_buf(),
                source_project_id: source.project_id().to_owned(),
                request,
            },
            format!(
                "다른 등록 프로젝트의 {} 값을 실제 값 노출 없이 현재 프로젝트로 한 번 복사합니다.",
                args.key
            ),
            affected_files,
            vec![args.key],
            "cross-project-value-copy",
            None,
        )
    }

    pub(super) fn open_registered(&self, project_path: &str) -> Result<ProjectService, EnvError> {
        let path = Path::new(project_path);
        let root = path
            .canonicalize()
            .map_err(|error| EnvError::io(path, error))?;
        self.open_registered_root(&root)
    }

    pub(super) fn open_registered_root(&self, root: &Path) -> Result<ProjectService, EnvError> {
        if !self.is_registered_root(root)? {
            return Err(EnvError::unregistered_project(
                "active-registration-required",
            ));
        }
        if !root.join(env_core::MANIFEST_FILE_NAME).is_file() {
            return Err(EnvError::unregistered_project("manifest-missing"));
        }
        ProjectService::open(root)
    }

    pub(super) fn is_registered_root(&self, root: &Path) -> Result<bool, EnvError> {
        Ok(self.registered_projects()?.into_iter().any(|candidate| {
            candidate
                .root
                .canonicalize()
                .is_ok_and(|candidate| candidate == root)
        }))
    }

    pub(super) fn open_current_workspace_candidate(&self) -> Result<ProjectService, EnvError> {
        let start = self
            .workspace_root_override
            .clone()
            .map_or_else(std::env::current_dir, Ok)
            .map_err(|error| EnvError::io(Path::new("."), error))?;
        let canonical = start
            .canonicalize()
            .map_err(|error| EnvError::io(&start, error))?;
        let root = if let Some(root) = git_worktree_root(&canonical) {
            root
        } else {
            if !looks_like_project_root(&canonical) {
                return Err(EnvError::invalid(
                    "현재 Broker 작업 폴더를 프로젝트로 확인하지 못했습니다. Codex에서 프로젝트 폴더를 작업 공간으로 연 뒤 다시 요청해주세요.",
                ));
            }
            canonical
        };
        reject_unsafe_registration_root(&root)?;
        ProjectService::open(root)
    }

    pub(super) fn open_registered_project_id(
        &self,
        project_id: &str,
    ) -> Result<ProjectService, EnvError> {
        for registration in self.registered_projects()? {
            let Ok(service) = ProjectService::open(&registration.root) else {
                continue;
            };
            if service.project_id() == project_id
                && service.root().join(env_core::MANIFEST_FILE_NAME).is_file()
            {
                return Ok(service);
            }
        }
        Err(EnvError::unregistered_project(project_id))
    }

    fn registered_projects(&self) -> Result<Vec<RegisteredProject>, EnvError> {
        if let Some(roots) = &self.registered_roots_override {
            return Ok(roots
                .iter()
                .map(|root| RegisteredProject {
                    id: ProjectService::open(root)
                        .map_or_else(|_| String::new(), |service| service.project_id().to_owned()),
                    name: root.file_name().map_or_else(
                        || "Project".to_owned(),
                        |name| name.to_string_lossy().into_owned(),
                    ),
                    display_path: root.to_string_lossy().into_owned(),
                    root: root.clone(),
                })
                .collect());
        }
        load_registered_projects(&self.registry_path()?)
    }

    pub(super) fn registry_path(&self) -> Result<PathBuf, EnvError> {
        if let Some(path) = std::env::var_os("KAVRANTA_REGISTRY_PATH")
            .or_else(|| std::env::var_os("ENV_MANAGER_REGISTRY_PATH"))
        {
            return Ok(PathBuf::from(path));
        }
        Ok(self.provider_app_data()?.join("projects.json"))
    }

    pub(super) fn provider_app_data(&self) -> Result<PathBuf, EnvError> {
        if let Some(path) = &self.provider_app_data_override {
            return Ok(path.clone());
        }
        provider_app_data()
    }
}

struct RegisteredProject {
    id: String,
    name: String,
    display_path: String,
    root: PathBuf,
}

fn load_registered_projects(path: &Path) -> Result<Vec<RegisteredProject>, EnvError> {
    let registry = load_registry_data(path)?;
    Ok(registry
        .projects
        .into_iter()
        .map(|project| RegisteredProject {
            id: project.id,
            name: project.name,
            display_path: project.display_path,
            root: project.root,
        })
        .collect())
}

fn validated_project_query(query: &str) -> Result<String, EnvError> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > 80 || query.chars().any(char::is_control) {
        return Err(EnvError::invalid(
            "프로젝트 검색어는 1~80자의 일반 문자여야 합니다.",
        ));
    }
    Ok(query.to_lowercase())
}

fn validated_variable_query(query: &str) -> Result<String, EnvError> {
    if query.chars().count() > 80 || query.chars().any(char::is_control) {
        return Err(EnvError::invalid(
            "변수 검색어는 영문자 또는 숫자 2~80자여야 합니다.",
        ));
    }
    let normalized = normalize_variable_query(query);
    if normalized.len() < 2 || normalized.len() > 80 {
        return Err(EnvError::invalid(
            "변수 검색어는 영문자 또는 숫자 2~80자여야 합니다.",
        ));
    }
    Ok(normalized)
}

fn validated_limit(
    requested: Option<usize>,
    default: usize,
    maximum: usize,
) -> Result<usize, EnvError> {
    let limit = requested.unwrap_or(default);
    if !(1..=maximum).contains(&limit) {
        return Err(EnvError::invalid(format!(
            "검색 결과 제한은 1~{maximum}이어야 합니다."
        )));
    }
    Ok(limit)
}

fn project_match_rank(project: &RegisteredProject, query: &str) -> Option<u8> {
    let id = project.id.to_lowercase();
    let name = project.name.to_lowercase();
    let display_path = project.display_path.to_lowercase();
    let root = project.root.to_string_lossy().to_lowercase();
    let basename = project
        .root
        .file_name()
        .map_or_else(String::new, |value| value.to_string_lossy().to_lowercase());
    if id == query || name == query {
        Some(0)
    } else if basename == query {
        Some(1)
    } else if name.starts_with(query) || basename.starts_with(query) {
        Some(2)
    } else if name.contains(query) || basename.contains(query) {
        Some(3)
    } else if display_path.contains(query) || root.contains(query) {
        Some(4)
    } else {
        None
    }
}

fn normalize_variable_query(query: &str) -> String {
    query
        .bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(|byte| byte.to_ascii_uppercase() as char)
        .collect()
}

fn variable_match_rank(key: &str, normalized_query: &str) -> u8 {
    let normalized_key = normalize_variable_query(key);
    if normalized_key == normalized_query {
        0
    } else if normalized_key.starts_with(normalized_query) {
        1
    } else {
        2
    }
}

pub(super) fn load_registry_data(path: &Path) -> Result<env_registry::RegistryData, EnvError> {
    env_registry::read(path)
}

pub(super) fn plan_expired() -> EnvError {
    EnvError::new(EnvErrorCode::PlanExpired, "계획이 없거나 만료되었습니다.")
}

pub(crate) fn provider_app_data() -> Result<PathBuf, EnvError> {
    if let Some(path) = std::env::var_os("KAVRANTA_APP_DATA_DIR")
        .or_else(|| std::env::var_os("ENV_MANAGER_APP_DATA_DIR"))
    {
        return Ok(PathBuf::from(path));
    }
    let base = directories::BaseDirs::new()
        .ok_or_else(|| EnvError::invalid("앱 데이터 경로를 확인하지 못했습니다."))?;
    Ok(base.data_dir().join("dev.hgc.env-manager"))
}

pub(super) fn git_worktree_root(start: &Path) -> Option<PathBuf> {
    let output = Command::new("git")
        .arg("-C")
        .arg(start)
        .args(["rev-parse", "--show-toplevel"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() || output.stdout.len() > 32 * 1024 {
        return None;
    }
    let root = PathBuf::from(String::from_utf8(output.stdout).ok()?.trim());
    let root = root.canonicalize().ok()?;
    start.starts_with(&root).then_some(root)
}

pub(super) fn looks_like_project_root(root: &Path) -> bool {
    const MARKERS: &[&str] = &[
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "go.mod",
        "Gemfile",
        "composer.json",
        ".env-manager.json",
    ];
    if MARKERS.iter().any(|marker| root.join(marker).is_file()) {
        return true;
    }
    fs::read_dir(root).is_ok_and(|entries| {
        entries.filter_map(Result::ok).any(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(env_core::is_env_candidate)
        })
    })
}

pub(super) fn reject_unsafe_registration_root(root: &Path) -> Result<(), EnvError> {
    if root.parent().is_none() {
        return Err(EnvError::invalid(
            "파일시스템 루트는 프로젝트로 등록할 수 없습니다.",
        ));
    }
    if directories::BaseDirs::new().is_some_and(|base| {
        base.home_dir()
            .canonicalize()
            .is_ok_and(|home| home == root)
    }) {
        return Err(EnvError::invalid(
            "사용자 홈 전체는 프로젝트로 등록할 수 없습니다.",
        ));
    }
    Ok(())
}
