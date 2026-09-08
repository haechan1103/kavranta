use super::super::*;

impl Broker {
    pub(super) fn verify_android_app_links(
        &self,
        args: VerifyAndroidAppLinksArgs,
    ) -> Result<Value, EnvError> {
        let service = self.open_registered(&args.project_path)?;
        let file = args.file.clone();
        let key = args.key.clone();
        let verification = env_provider::android_app_links::verify(
            &service,
            AndroidAppLinksVerificationRequest {
                file: args.file,
                key: args.key,
                package_name: args.package_name,
                hosts: args.hosts,
            },
        )
        .map_err(android_app_links_error);
        let result_code = verification
            .as_ref()
            .map_or_else(|error| error.code().as_str(), |_| "OK");
        self.audit(
            service.project_id(),
            "verify_android_app_links",
            std::slice::from_ref(&file),
            std::slice::from_ref(&key),
            "opaque-public-fingerprint-verification",
            result_code,
        );
        serde_json::to_value(verification?).map_err(EnvError::serialization)
    }
}

fn android_app_links_error(
    error: env_provider::android_app_links::AndroidAppLinksError,
) -> EnvError {
    EnvError::invalid(format!("{}: {}", error.code, error.message))
}
