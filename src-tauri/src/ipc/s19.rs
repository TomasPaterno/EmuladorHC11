//! Parser Motorola S-record (S19) en el adaptador. No toca el filesystem.

pub const MAX_S19_TEXT_BYTES: usize = 256 * 1024;
pub const MAX_S19_PAYLOAD_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AddressRange {
    pub start: u16,
    pub end: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S19Summary {
    pub record_count: u32,
    pub bytes_loaded: u32,
    pub ranges: Vec<AddressRange>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedS19 {
    pub bytes: Vec<(u16, u8)>,
    pub summary: S19Summary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum S19Error {
    Invalid,
    Checksum,
    UnsupportedRecord { kind: char },
    TooLarge { length: usize },
    OutOfRange { start: u16, length: usize },
}

impl S19Error {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Invalid => "invalid_s19",
            Self::Checksum => "s19_checksum",
            Self::UnsupportedRecord { .. } => "s19_unsupported_record",
            Self::TooLarge { .. } => "load_too_large",
            Self::OutOfRange { .. } => "load_out_of_range",
        }
    }
}

impl std::fmt::Display for S19Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid => write!(f, "el archivo S19 no es válido"),
            Self::Checksum => write!(f, "checksum S19 inválido"),
            Self::UnsupportedRecord { kind } => {
                write!(f, "registro S{kind} no soportado")
            }
            Self::TooLarge { length } => {
                write!(f, "carga de {length} bytes excede el máximo permitido")
            }
            Self::OutOfRange { start, length } => write!(
                f,
                "carga de {length} bytes desde ${start:04X} sale del espacio de 64 KiB"
            ),
        }
    }
}

pub fn parse_s19(contents: &str) -> Result<ParsedS19, S19Error> {
    if contents.len() > MAX_S19_TEXT_BYTES {
        return Err(S19Error::TooLarge {
            length: contents.len(),
        });
    }

    let mut image = Vec::new();
    let mut record_count = 0_u32;
    let mut saw_record = false;

    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        saw_record = true;
        match parse_record(line)? {
            Record::Ignore => {}
            Record::Data(pairs) => {
                record_count = record_count.saturating_add(1);
                image.extend(pairs);
            }
        }
    }

    if !saw_record {
        return Err(S19Error::Invalid);
    }
    if image.len() > MAX_S19_PAYLOAD_BYTES {
        return Err(S19Error::TooLarge {
            length: image.len(),
        });
    }

    let bytes = last_write_wins(image);
    let ranges = compact_ranges(&bytes);
    Ok(ParsedS19 {
        summary: S19Summary {
            record_count,
            bytes_loaded: bytes.len() as u32,
            ranges,
        },
        bytes,
    })
}

enum Record {
    Ignore,
    Data(Vec<(u16, u8)>),
}

fn parse_record(line: &str) -> Result<Record, S19Error> {
    let bytes = line.as_bytes();
    if bytes.len() < 4 || (bytes[0] != b'S' && bytes[0] != b's') {
        return Err(S19Error::Invalid);
    }
    let kind = char::from(bytes[1]).to_ascii_uppercase();
    let hex = std::str::from_utf8(&bytes[2..]).map_err(|_| S19Error::Invalid)?;
    if hex.len() < 2 || !hex.len().is_multiple_of(2) || !hex.is_ascii() {
        return Err(S19Error::Invalid);
    }

    let payload = decode_hex(hex)?;
    if payload.is_empty() {
        return Err(S19Error::Invalid);
    }
    let count = usize::from(payload[0]);
    if payload.len() != count + 1 {
        return Err(S19Error::Invalid);
    }
    if !checksum_ok(&payload) {
        return Err(S19Error::Checksum);
    }

    match kind {
        '0' | '5' | '9' => {
            if count < 3 {
                return Err(S19Error::Invalid);
            }
            Ok(Record::Ignore)
        }
        '1' => parse_s1(&payload[1..payload.len() - 1]),
        '2' | '3' | '7' | '8' => Err(S19Error::UnsupportedRecord { kind }),
        _ => Err(S19Error::Invalid),
    }
}

fn parse_s1(address_and_data: &[u8]) -> Result<Record, S19Error> {
    if address_and_data.len() < 2 {
        return Err(S19Error::Invalid);
    }
    let start = u16::from_be_bytes([address_and_data[0], address_and_data[1]]);
    let data = &address_and_data[2..];
    let end = u32::from(start).saturating_add(data.len() as u32);
    if end > 0x1_0000 {
        return Err(S19Error::OutOfRange {
            start,
            length: data.len(),
        });
    }
    let pairs = data
        .iter()
        .enumerate()
        .map(|(index, value)| (start + index as u16, *value))
        .collect();
    Ok(Record::Data(pairs))
}

fn decode_hex(hex: &str) -> Result<Vec<u8>, S19Error> {
    let mut out = Vec::with_capacity(hex.len() / 2);
    let chars: Vec<char> = hex.chars().collect();
    for chunk in chars.chunks_exact(2) {
        let text: String = chunk.iter().collect();
        let value = u8::from_str_radix(&text, 16).map_err(|_| S19Error::Invalid)?;
        out.push(value);
    }
    Ok(out)
}

pub(crate) fn checksum_ok(payload: &[u8]) -> bool {
    payload
        .iter()
        .fold(0_u8, |acc, byte| acc.wrapping_add(*byte))
        == 0xFF
}

fn last_write_wins(pairs: Vec<(u16, u8)>) -> Vec<(u16, u8)> {
    let mut map = std::collections::BTreeMap::new();
    for (address, value) in pairs {
        map.insert(address, value);
    }
    map.into_iter().collect()
}

fn compact_ranges(bytes: &[(u16, u8)]) -> Vec<AddressRange> {
    let mut ranges = Vec::new();
    let mut current: Option<AddressRange> = None;
    for &(address, _) in bytes {
        current = Some(match current {
            Some(range) if u32::from(range.end) + 1 == u32::from(address) => AddressRange {
                start: range.start,
                end: address,
            },
            Some(range) => {
                ranges.push(range);
                AddressRange {
                    start: address,
                    end: address,
                }
            }
            None => AddressRange {
                start: address,
                end: address,
            },
        });
    }
    if let Some(range) = current {
        ranges.push(range);
    }
    ranges
}

#[cfg(test)]
mod tests {
    use super::{MAX_S19_PAYLOAD_BYTES, MAX_S19_TEXT_BYTES, S19Error, checksum_ok, parse_s19};

    fn record(kind: char, bytes: &[u8]) -> String {
        let count = bytes.len() as u8 + 1;
        let mut payload = Vec::with_capacity(bytes.len() + 2);
        payload.push(count);
        payload.extend_from_slice(bytes);
        let sum = payload
            .iter()
            .fold(0_u8, |acc, byte| acc.wrapping_add(*byte));
        payload.push(!sum);
        debug_assert!(checksum_ok(&payload));
        let mut line = format!("S{kind}");
        for byte in payload {
            line.push_str(&format!("{byte:02X}"));
        }
        line
    }

    #[test]
    fn s1_loads_data_bytes() {
        let contents = format!(
            "{}\n{}\n",
            record('1', &[0xD0, 0x00, 0x01]),
            record('9', &[0x00, 0x00])
        );
        let parsed = parse_s19(&contents).expect("S1");
        assert_eq!(parsed.bytes, vec![(0xD000, 0x01)]);
        assert_eq!(parsed.summary.record_count, 1);
        assert_eq!(parsed.summary.bytes_loaded, 1);
        assert_eq!(parsed.summary.ranges[0].start, 0xD000);
        assert_eq!(parsed.summary.ranges[0].end, 0xD000);
    }

    #[test]
    fn s0_s1_s9_is_valid() {
        let contents = [
            record('0', &[0x00, 0x00, b'H', b'D', b'R']),
            record('1', &[0x00, 0x00, 0x01, 0x01]),
            record('5', &[0x00, 0x01]),
            record('9', &[0x00, 0x00]),
        ]
        .join("\n");
        let parsed = parse_s19(&contents).expect("S0+S1+S9");
        assert_eq!(parsed.bytes, vec![(0x0000, 0x01), (0x0001, 0x01)]);
        assert_eq!(parsed.summary.record_count, 1);
        assert_eq!(parsed.summary.ranges.len(), 1);
        assert_eq!(parsed.summary.ranges[0].end, 0x0001);
    }

    #[test]
    fn bad_checksum_is_error() {
        let error = parse_s19("S104D0000100\n").expect_err("checksum");
        assert_eq!(error, S19Error::Checksum);
        assert_eq!(error.code(), "s19_checksum");
    }

    #[test]
    fn unsupported_s2_is_error() {
        let line = record('2', &[0x00, 0xD0, 0x00, 0x01]);
        let error = parse_s19(&line).expect_err("S2");
        assert_eq!(error, S19Error::UnsupportedRecord { kind: '2' });
        assert_eq!(error.code(), "s19_unsupported_record");
        assert!(!error.to_string().contains("D000"));
    }

    #[test]
    fn wrap_past_64k_is_error() {
        let error = parse_s19(&record('1', &[0xFF, 0xFF, 0x01, 0x02])).expect_err("wrap");
        assert_eq!(
            error,
            S19Error::OutOfRange {
                start: 0xFFFF,
                length: 2
            }
        );
    }

    #[test]
    fn empty_file_is_invalid() {
        assert_eq!(parse_s19("").expect_err("vacío"), S19Error::Invalid);
        assert_eq!(parse_s19("   \n\n").expect_err("blanco"), S19Error::Invalid);
    }

    #[test]
    fn huge_text_is_rejected() {
        let contents = "S".repeat(MAX_S19_TEXT_BYTES + 1);
        let error = parse_s19(&contents).expect_err("texto enorme");
        assert!(matches!(error, S19Error::TooLarge { length } if length == MAX_S19_TEXT_BYTES + 1));
    }

    #[test]
    fn huge_payload_is_rejected() {
        let mut lines = Vec::new();
        let chunks = MAX_S19_PAYLOAD_BYTES / 16 + 1;
        for index in 0..chunks {
            let start = (index * 16) as u16;
            let mut body = vec![(start >> 8) as u8, start as u8];
            body.extend(std::iter::repeat_n(0x01, 16));
            lines.push(record('1', &body));
        }
        let error = parse_s19(&lines.join("\n")).expect_err("payload");
        assert!(matches!(error, S19Error::TooLarge { .. }));
    }
}
