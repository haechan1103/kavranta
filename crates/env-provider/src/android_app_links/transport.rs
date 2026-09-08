use std::io::Read;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::time::Duration;

const MAX_RESPONSE_BYTES: u64 = 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone)]
pub(super) struct FetchResponse {
    pub status: u16,
    pub content_type_is_json: bool,
    pub body: Vec<u8>,
}

#[derive(Debug, Clone, Copy)]
pub(super) enum FetchError {
    UnsafeAddress,
    ResponseTooLarge,
    RequestFailed,
}

pub(super) trait AssetLinksFetcher {
    fn fetch(&self, host: &str) -> Result<FetchResponse, FetchError>;
}

pub(super) struct HttpsAssetLinksFetcher;

impl AssetLinksFetcher for HttpsAssetLinksFetcher {
    fn fetch(&self, host: &str) -> Result<FetchResponse, FetchError> {
        let addresses = resolve_public_addresses(host)?;
        ensure_crypto_provider()?;
        let client = reqwest::blocking::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .no_proxy()
            .referer(false)
            .timeout(REQUEST_TIMEOUT)
            .resolve_to_addrs(host, &addresses)
            .build()
            .map_err(|_| FetchError::RequestFailed)?;
        let response = client
            .get(format!("https://{host}/.well-known/assetlinks.json"))
            .send()
            .map_err(|_| FetchError::RequestFailed)?;
        let status = response.status().as_u16();
        let content_type_is_json = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"));
        if status != 200 {
            return Ok(FetchResponse {
                status,
                content_type_is_json,
                body: Vec::new(),
            });
        }

        let mut body = Vec::new();
        response
            .take(MAX_RESPONSE_BYTES + 1)
            .read_to_end(&mut body)
            .map_err(|_| FetchError::RequestFailed)?;
        if body.len() as u64 > MAX_RESPONSE_BYTES {
            return Err(FetchError::ResponseTooLarge);
        }
        Ok(FetchResponse {
            status,
            content_type_is_json,
            body,
        })
    }
}

fn resolve_public_addresses(host: &str) -> Result<Vec<SocketAddr>, FetchError> {
    let addresses = (host, 443)
        .to_socket_addrs()
        .map_err(|_| FetchError::RequestFailed)?
        .collect::<Vec<_>>();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err(FetchError::UnsafeAddress);
    }
    Ok(addresses)
}

fn is_public_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => is_public_ipv4(address),
        IpAddr::V6(address) => is_public_ipv6(address),
    }
}

fn is_public_ipv4(address: Ipv4Addr) -> bool {
    let [a, b, c, _] = address.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 192 && b == 88 && c == 99)
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113))
}

fn is_public_ipv6(address: Ipv6Addr) -> bool {
    let segments = address.segments();
    (segments[0] & 0xe000) == 0x2000 && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
}

fn ensure_crypto_provider() -> Result<(), FetchError> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    }
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        return Err(FetchError::RequestFailed);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_private_reserved_and_documentation_addresses() {
        for address in [
            "127.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "169.254.1.1",
            "172.16.0.1",
            "192.168.0.1",
            "192.0.2.1",
            "198.51.100.1",
            "203.0.113.1",
            "::1",
            "fc00::1",
            "fe80::1",
            "2001:db8::1",
        ] {
            assert!(!is_public_ip(address.parse().expect("IP")), "{address}");
        }
        assert!(is_public_ip("8.8.8.8".parse().expect("public IPv4")));
        assert!(is_public_ip(
            "2606:4700:4700::1111".parse().expect("public IPv6")
        ));
    }
}
