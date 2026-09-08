use std::collections::BTreeSet;

use zeroize::Zeroizing;

pub(super) type Fingerprint = [u8; 32];

#[derive(Debug)]
pub(super) struct FingerprintError;

pub(super) fn parse_fingerprint_list(
    value: &str,
) -> Result<BTreeSet<Fingerprint>, FingerprintError> {
    let entries = Zeroizing::new(if value.trim_start().starts_with('[') {
        serde_json::from_str::<Vec<String>>(value).map_err(|_| FingerprintError)?
    } else {
        value
            .split([',', ';', '\n', '\r'])
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(str::to_owned)
            .collect()
    });
    if entries.is_empty() || entries.len() > 20 {
        return Err(FingerprintError);
    }
    entries
        .iter()
        .map(|entry| parse_fingerprint(entry))
        .collect()
}

pub(super) fn parse_fingerprint(value: &str) -> Result<Fingerprint, FingerprintError> {
    let value = value.trim();
    let value = value
        .strip_prefix("SHA256:")
        .or_else(|| value.strip_prefix("sha256:"))
        .map(str::trim)
        .unwrap_or(value);
    let compact = Zeroizing::new(if value.len() == 95 {
        if value.bytes().enumerate().any(|(index, byte)| {
            if index % 3 == 2 {
                byte != b':'
            } else {
                !byte.is_ascii_hexdigit()
            }
        }) {
            return Err(FingerprintError);
        }
        value
            .chars()
            .filter(|character| *character != ':')
            .collect()
    } else if value.len() == 64 {
        value.to_owned()
    } else {
        return Err(FingerprintError);
    });
    if !compact.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(FingerprintError);
    }

    let mut bytes = [0_u8; 32];
    for (index, pair) in compact.as_bytes().chunks_exact(2).enumerate() {
        bytes[index] = (hex_nibble(pair[0])? << 4) | hex_nibble(pair[1])?;
    }
    Ok(bytes)
}

fn hex_nibble(value: u8) -> Result<u8, FingerprintError> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err(FingerprintError),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const COLON: &str = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

    #[test]
    fn parses_colon_compact_and_json_lists_as_bytes() {
        let compact = COLON.replace(':', "").to_ascii_lowercase();
        let json = serde_json::to_string(&vec![COLON, compact.as_str()]).expect("json");
        let parsed = parse_fingerprint_list(&json).expect("fingerprints");
        assert_eq!(parsed.len(), 1);
    }

    #[test]
    fn rejects_mixed_or_partial_content() {
        assert!(parse_fingerprint_list(&format!("{COLON},not-a-fingerprint")).is_err());
        assert!(parse_fingerprint_list("14:6D:E9").is_err());
        let mut misplaced = COLON.as_bytes().to_vec();
        misplaced[0] = b':';
        assert!(parse_fingerprint(std::str::from_utf8(&misplaced).expect("utf8")).is_err());
    }
}
