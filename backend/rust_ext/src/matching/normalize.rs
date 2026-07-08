use regex::Regex;
use std::collections::HashSet;

static BANK_PREFIXES: &[(&str, &[&str])] = &[
    (
        "BANCO_CHILE_CSV",
        &[
            r"^TEF/",
            r"^TRANSF\.?\s*",
            r"^TRANSFERENCIA\s+DE\s+",
            r"^CARGO\s+",
            r"^ABONO\s+",
            r"^PAG\s+",
            r"^PAGO\s+",
        ],
    ),
    (
        "SANTANDER_CSV",
        &[
            r"^ABO TR\s+",
            r"^ABO\s+TR\s+",
            r"^CAR TR\s+",
            r"^CAR\s+TR\s+",
            r"^TRANS\s+",
            r"^TRF\s+",
            r"^TRFXINT\s+",
        ],
    ),
    (
        "BICE_CSV",
        &[r"^TEF EFEC\s+", r"^TEF\s+EFEC\s+", r"^OAB\s+", r"^CARGOS\s+"],
    ),
    (
        "BCI_CSV",
        &[
            r"^TRANSFERENCIA\s+ELECTRÓNICA\s+",
            r"^TE\s+",
            r"^ABONO\s+TRANSFERENCIA\s+",
        ],
    ),
    (
        "SCOTIABANK_CSV",
        &[r"^TEF\s+", r"^TRANS\s+", r"^ABONO\s+"],
    ),
    ("ITAU_CSV", &[r"^TRF\s+", r"^TRANSF\s+", r"^PAG\s+"]),
    (
        "ESTADO_CSV",
        &[r"^DEPOSITO\s+", r"^DEP\s+", r"^PAGO\s+", r"^TEF\s+"],
    ),
];

static GENERIC_PREFIXES: &[&str] = &[
    r"^TRANSF(?:ERENCIA)?\s+(?:ELECTRÓNICA\s+)?",
    r"^TEF/?",
    r"^TRF/?",
    r"^PAGO\s+",
    r"^PAG\s+",
    r"^ABONO\s+",
    r"^CARGO\s+",
    r"^DEPOSITO\s+",
    r"^DEP\s+",
    r"^COM(?:ISIÓN)?\s+",
];

fn stop_words() -> HashSet<&'static str> {
    [
        "DE", "LA", "EL", "LOS", "LAS", "DEL", "AL", "CON", "POR", "SPA", "LTDA", "SA", "SRL",
        "EIRL", "S.A.", "LTDA.", "CL", "RUT", "RUN", "TEF", "TRF", "TRANS",
    ]
    .into_iter()
    .collect()
}

pub fn normalize_description(text: &str, bank_format: Option<&str>) -> String {
    if text.is_empty() {
        return String::new();
    }

    let mut normalized = text.trim().to_uppercase();

    // Step 1: Apply bank-specific prefixes
    if let Some(fmt) = bank_format {
        for &(name, prefixes) in BANK_PREFIXES {
            if name == fmt {
                for pattern in prefixes {
                    if let Ok(re) = Regex::new(pattern) {
                        normalized = re.replace_all(&normalized, "").to_string().trim().to_string();
                    }
                }
                break;
            }
        }
    }

    // Step 2: Apply generic prefixes
    for pattern in GENERIC_PREFIXES {
        if let Ok(re) = Regex::new(pattern) {
            normalized = re.replace_all(&normalized, "").to_string().trim().to_string();
        }
    }

    // Step 3: Remove parenthesized/bracketed content
    if let Ok(re) = Regex::new(r"[\[\(\{][^\]\)\}]*[\]\)\}]") {
        normalized = re.replace_all(&normalized, "").to_string().trim().to_string();
    }

    // Step 4: Remove RUT numbers (12.345.678-9 format)
    if let Ok(re) = Regex::new(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b") {
        normalized = re.replace_all(&normalized, "").to_string().trim().to_string();
    }

    // Step 5: Remove stop words
    let stops = stop_words();
    let tokens: Vec<&str> = normalized
        .split_whitespace()
        .filter(|t| !stops.contains(t) && t.len() >= 2)
        .collect();

    tokens.join(" ")
}

pub fn normalize_bag(text: &str, bank_format: Option<&str>) -> HashSet<String> {
    let normalized = normalize_description(text, bank_format);
    normalized
        .split_whitespace()
        .filter(|t| t.len() >= 3)
        .map(|t| t.to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_banco_chile_normalize() {
        let result = normalize_description("TEF/COMERCIAL ANDES SPA", Some("BANCO_CHILE_CSV"));
        assert_eq!(result, "COMERCIAL ANDES");
    }

    #[test]
    fn test_empty_text() {
        let result = normalize_description("", Some("BANCO_CHILE_CSV"));
        assert_eq!(result, "");
    }

    #[test]
    fn test_santander_prefix() {
        let result = normalize_description("ABO TR COMERCIAL ANDES SPA", Some("SANTANDER_CSV"));
        assert_eq!(result, "COMERCIAL ANDES");
    }

    #[test]
    fn test_strip_stop_words() {
        let result = normalize_description("PAGO DE FACTURA SPA", None);
        assert_eq!(result, "FACTURA");
    }

    #[test]
    fn test_normalize_bag() {
        let bag = normalize_bag("TEF/COMERCIAL ANDES SPA", Some("BANCO_CHILE_CSV"));
        assert!(bag.contains("COMERCIAL"));
        assert!(bag.contains("ANDES"));
        assert!(!bag.contains("SPA"));
    }
}
