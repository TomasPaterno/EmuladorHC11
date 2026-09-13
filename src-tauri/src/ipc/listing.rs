//! Parser de listado de ensamblador ya compilado. No toca el filesystem.

use super::s19::AddressRange;

pub const MAX_LISTING_TEXT_BYTES: usize = 256 * 1024;
pub const MAX_LISTING_PAYLOAD_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListingSummary {
    pub record_count: u32,
    pub bytes_loaded: u32,
    pub ranges: Vec<AddressRange>,
    pub entry: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedListing {
    pub bytes: Vec<(u16, u8)>,
    pub summary: ListingSummary,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ListingError {
    Invalid,
    TooLarge { length: usize },
    OutOfRange { start: u16, length: usize },
}

impl ListingError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Invalid => "invalid_listing",
            Self::TooLarge { .. } => "load_too_large",
            Self::OutOfRange { .. } => "load_out_of_range",
        }
    }
}

impl std::fmt::Display for ListingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid => write!(f, "el listado compilado no es válido"),
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

pub fn parse_listing(contents: &str) -> Result<ParsedListing, ListingError> {
    if contents.len() > MAX_LISTING_TEXT_BYTES {
        return Err(ListingError::TooLarge {
            length: contents.len(),
        });
    }

    let mut image = Vec::new();
    let mut record_count = 0_u32;
    let mut saw_line = false;

    for raw_line in contents.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        saw_line = true;
        if let Some(pairs) = parse_line(line)? {
            record_count = record_count.saturating_add(1);
            image.extend(pairs);
        }
    }

    if !saw_line || image.is_empty() {
        return Err(ListingError::Invalid);
    }
    if image.len() > MAX_LISTING_PAYLOAD_BYTES {
        return Err(ListingError::TooLarge {
            length: image.len(),
        });
    }

    let bytes = last_write_wins(image);
    let entry = bytes[0].0;
    let ranges = compact_ranges(&bytes);
    Ok(ParsedListing {
        summary: ListingSummary {
            record_count,
            bytes_loaded: bytes.len() as u32,
            ranges,
            entry,
        },
        bytes,
    })
}

fn parse_line(line: &str) -> Result<Option<Vec<(u16, u8)>>, ListingError> {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    if tokens.len() < 2 {
        return Err(ListingError::Invalid);
    }
    if tokens[0].parse::<u32>().is_err() {
        return Err(ListingError::Invalid);
    }
    if !is_hex_word(tokens[1]) {
        return Err(ListingError::Invalid);
    }
    let start = u16::from_str_radix(tokens[1], 16).map_err(|_| ListingError::Invalid)?;
    let data = &tokens[2..];
    if data.is_empty() {
        return Ok(None);
    }
    let mut values = Vec::with_capacity(data.len());
    for token in data {
        if !is_hex_byte(token) {
            return Err(ListingError::Invalid);
        }
        values.push(u8::from_str_radix(token, 16).map_err(|_| ListingError::Invalid)?);
    }
    let end = u32::from(start).saturating_add(values.len() as u32);
    if end > 0x1_0000 {
        return Err(ListingError::OutOfRange {
            start,
            length: values.len(),
        });
    }
    Ok(Some(
        values
            .into_iter()
            .enumerate()
            .map(|(index, value)| (start + index as u16, value))
            .collect(),
    ))
}

fn is_hex_word(token: &str) -> bool {
    (1..=4).contains(&token.len()) && token.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn is_hex_byte(token: &str) -> bool {
    token.len() == 2 && token.chars().all(|ch| ch.is_ascii_hexdigit())
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
pub const SAMPLE_LISTING: &str = "\
1 0000
2 2000
3 2000 86 08
4 2002 97 60
5 2004 CE 30 00
6 2007 4F
7 2008 4C
8 2009 A7 00
9 200B A7 01
10 200D A6 00
11 200F E6 01
12 2011 1B
13 2012 A7 02
14 2014 08
15 2015 7A 00 60
16 2018 26 F3
17 201A 7E 20 1A
";

#[cfg(test)]
mod tests {
    use super::{
        ListingError, MAX_LISTING_PAYLOAD_BYTES, MAX_LISTING_TEXT_BYTES, SAMPLE_LISTING,
        parse_listing,
    };

    #[test]
    fn sample_listing_loads_at_2000() {
        let parsed = parse_listing(SAMPLE_LISTING).expect("listado");
        assert_eq!(parsed.summary.entry, 0x2000);
        assert_eq!(parsed.summary.record_count, 15);
        assert_eq!(parsed.bytes[0], (0x2000, 0x86));
        assert_eq!(parsed.bytes.last().copied(), Some((0x201C, 0x1A)));
        assert_eq!(parsed.summary.ranges[0].start, 0x2000);
        assert_eq!(parsed.summary.ranges[0].end, 0x201C);
    }

    #[test]
    fn org_only_is_invalid() {
        assert_eq!(
            parse_listing("1 0000\n2 2000\n").expect_err("ORG"),
            ListingError::Invalid
        );
    }

    #[test]
    fn wrap_past_64k_is_error() {
        let error = parse_listing("1 FFFF 01 02").expect_err("wrap");
        assert_eq!(
            error,
            ListingError::OutOfRange {
                start: 0xFFFF,
                length: 2
            }
        );
        assert!(!error.to_string().contains("01 02"));
    }

    #[test]
    fn huge_text_is_rejected() {
        let contents = "1".repeat(MAX_LISTING_TEXT_BYTES + 1);
        let error = parse_listing(&contents).expect_err("texto");
        assert!(
            matches!(error, ListingError::TooLarge { length } if length == MAX_LISTING_TEXT_BYTES + 1)
        );
    }

    #[test]
    fn huge_payload_is_rejected() {
        let mut lines = Vec::new();
        let chunks = MAX_LISTING_PAYLOAD_BYTES / 16 + 1;
        for index in 0..chunks {
            let start = index * 16;
            let mut line = format!("{} {start:04X}", index + 1);
            for _ in 0..16 {
                line.push_str(" 01");
            }
            lines.push(line);
        }
        let error = parse_listing(&lines.join("\n")).expect_err("payload");
        assert!(matches!(error, ListingError::TooLarge { .. }));
    }
}
