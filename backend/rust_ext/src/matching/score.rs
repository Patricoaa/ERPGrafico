use crate::matching::normalize::normalize_description;
use chrono::NaiveDate;
use serde::Deserialize;
use serde::Serialize;

// ── Input structs (deserialized from JSON sent by Python) ──────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineData {
    pub id: i64,
    pub credit: f64,
    pub debit: f64,
    pub transaction_date: String,
    pub transaction_id: Option<String>,
    pub reference: Option<String>,
    pub description: Option<String>,
    pub bank_format: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentData {
    pub id: i64,
    pub amount: f64,
    pub date: String,
    pub transaction_number: Option<String>,
    pub contact_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsData {
    pub amount_weight: f64,
    pub date_weight: f64,
    pub reference_weight: f64,
    pub contact_weight: f64,
}

// ── Output struct (serialized to JSON for Python) ──────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SingleScoreOutput {
    pub line_idx: usize,
    pub payment_idx: usize,
    pub score: f64,
    pub reasons: Vec<String>,
    pub difference: f64,
}

// ── Core scoring logic ─────────────────────────────────────────────────────

fn parse_date(s: &str) -> Option<NaiveDate> {
    // Try ISO format first (YYYY-MM-DD)
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Some(d);
    }
    // Try ISO with T (YYYY-MM-DDT...)
    if let Ok(d) = NaiveDate::parse_from_str(s.split('T').next().unwrap_or(s), "%Y-%m-%d") {
        return Some(d);
    }
    None
}

fn compute_amount_score(line_amount: f64, payment_amount: f64) -> (f64, Vec<&'static str>) {
    let mut reasons = Vec::new();
    let score = if (line_amount - payment_amount).abs() < f64::EPSILON {
        reasons.push("exact_amount");
        100.0
    } else if (line_amount - payment_amount).abs() <= payment_amount * 0.05 {
        reasons.push("similar_amount");
        50.0
    } else {
        0.0
    };
    (score, reasons)
}

fn compute_date_score(
    transaction_date: &str,
    payment_date: &str,
) -> (f64, Vec<&'static str>) {
    let mut reasons = Vec::new();
    let line_date = match parse_date(transaction_date) {
        Some(d) => d,
        None => return (0.0, reasons),
    };
    let pay_date = match parse_date(payment_date) {
        Some(d) => d,
        None => return (0.0, reasons),
    };

    let diff_days = (line_date - pay_date).num_days().unsigned_abs();

    let score = match diff_days {
        0 => {
            reasons.push("exact_date");
            100.0
        }
        1 => {
            reasons.push("date_1day");
            80.0
        }
        2..=3 => {
            reasons.push("date_3days");
            50.0
        }
        4..=7 => {
            reasons.push("date_week");
            20.0
        }
        _ => 0.0,
    };
    (score, reasons)
}

fn compute_reference_score(
    transaction_id: Option<&str>,
    reference: Option<&str>,
    transaction_number: Option<&str>,
) -> (f64, Vec<&'static str>) {
    let mut reasons = Vec::new();
    let mut score = 0.0;

    let tn = match transaction_number {
        Some(t) => t.trim().to_uppercase(),
        None => return (0.0, reasons),
    };

    // Check transaction_id vs transaction_number
    if let Some(tid) = transaction_id {
        let tid = tid.trim().to_uppercase();
        if tid == tn {
            score = 100.0;
            reasons.push("exact_id_match");
        } else if tid.contains(&tn) || tn.contains(&tid) {
            score = 60.0;
            reasons.push("partial_id_match");
        }
    }

    // Check reference vs transaction_number (only if ref_score < 80)
    if score < 80.0 {
        if let Some(ref_text) = reference {
            let ref_text = ref_text.trim().to_uppercase();
            if ref_text == tn {
                score = 80.0;
                reasons.push("exact_ref_match");
            } else if ref_text.contains(&tn) || tn.contains(&ref_text) {
                score = 50.0;
                reasons.push("partial_ref_match");
            }
        }
    }

    (score, reasons)
}

fn compute_contact_score(
    contact_name: Option<&str>,
    description: Option<&str>,
    bank_format: Option<&str>,
) -> (f64, Vec<&'static str>) {
    let mut reasons = Vec::new();
    let cname = match contact_name {
        Some(n) => n.trim().to_uppercase(),
        None => return (0.0, reasons),
    };

    let desc = match description {
        Some(d) => d,
        None => return (0.0, reasons),
    };

    let normalized_desc = normalize_description(desc, bank_format);
    if normalized_desc.is_empty() {
        return (0.0, reasons);
    }

    // Use Jaro-Winkler similarity for fuzzy matching
    let ratio = strsim::jaro_winkler(&cname, &normalized_desc) * 100.0;

    if ratio >= 70.0 {
        if (ratio - 100.0).abs() < f64::EPSILON {
            reasons.push("contact_name_match");
        } else {
            reasons.push("contact_fuzzy_match");
        }
        (ratio, reasons)
    } else {
        (0.0, reasons)
    }
}

/// Compute match score for a single line-payment pair.
/// Returns the score, reasons, and amount difference.
fn calculate_single_score(
    line: &LineData,
    payment: &PaymentData,
    settings: &SettingsData,
) -> SingleScoreOutput {
    let line_amount = (line.credit - line.debit).abs();
    let payment_amount = payment.amount.abs();
    let difference = line_amount - payment_amount;

    let mut all_reasons: Vec<String> = Vec::new();

    // 1. Amount score
    let (amount_score, a_reasons) = compute_amount_score(line_amount, payment_amount);
    all_reasons.extend(a_reasons.iter().map(|s| s.to_string()));

    // 2. Date score (line.transaction_date vs payment.date)
    let (date_score, d_reasons) =
        compute_date_score(&line.transaction_date, &payment.date);
    all_reasons.extend(d_reasons.iter().map(|s| s.to_string()));

    // 3. Reference/ID score
    let (ref_score, r_reasons) = compute_reference_score(
        line.transaction_id.as_deref(),
        line.reference.as_deref(),
        payment.transaction_number.as_deref(),
    );
    all_reasons.extend(r_reasons.iter().map(|s| s.to_string()));

    // 4. Contact score
    let (contact_score, c_reasons) = compute_contact_score(
        payment.contact_name.as_deref(),
        line.description.as_deref(),
        line.bank_format.as_deref(),
    );
    all_reasons.extend(c_reasons.iter().map(|s| s.to_string()));

    // Weighted average
    let total_weight =
        settings.amount_weight + settings.date_weight + settings.reference_weight + settings.contact_weight;
    let total_weight = if total_weight == 0.0 { 100.0 } else { total_weight };

    let final_score = (amount_score * settings.amount_weight
        + date_score * settings.date_weight
        + ref_score * settings.reference_weight
        + contact_score * settings.contact_weight)
        / total_weight;

    SingleScoreOutput {
        line_idx: 0,  // filled by caller
        payment_idx: 0, // filled by caller
        score: (final_score * 100.0).round() / 100.0, // round to 2 decimals
        reasons: all_reasons,
        difference,
    }
}

// ── Public batch function ──────────────────────────────────────────────────

/// Batch compute match scores for all line-payment pairs.
/// Takes serialized JSON arrays as input, returns serialized JSON array of scores.
pub fn batch_match_scores(
    lines_json: &str,
    payments_json: &str,
    settings_json: &str,
) -> Result<String, String> {
    let lines: Vec<LineData> = serde_json::from_str(lines_json).map_err(|e| format!("lines deser: {e}"))?;
    let payments: Vec<PaymentData> =
        serde_json::from_str(payments_json).map_err(|e| format!("payments deser: {e}"))?;
    let settings: SettingsData =
        serde_json::from_str(settings_json).map_err(|e| format!("settings deser: {e}"))?;

    let mut results = Vec::with_capacity(lines.len() * payments.len());

    for (li, line) in lines.iter().enumerate() {
        for (pi, payment) in payments.iter().enumerate() {
            let mut score = calculate_single_score(line, payment, &settings);
            score.line_idx = li;
            score.payment_idx = pi;
            results.push(score);
        }
    }

    serde_json::to_string(&results).map_err(|e| format!("serialize output: {e}"))
}

/// Compute the best payment match per line (for auto-match optimization).
/// Returns for each line: line_idx, payment_idx, score, reasons, difference.
/// If no payment meets the threshold, the entry has score = 0.0 and payment_idx = None.
pub fn best_match_per_line(
    lines_json: &str,
    payments_json: &str,
    settings_json: &str,
    threshold: f64,
) -> Result<String, String> {
    let lines: Vec<LineData> = serde_json::from_str(lines_json).map_err(|e| format!("lines deser: {e}"))?;
    let payments: Vec<PaymentData> =
        serde_json::from_str(payments_json).map_err(|e| format!("payments deser: {e}"))?;
    let settings: SettingsData =
        serde_json::from_str(settings_json).map_err(|e| format!("settings deser: {e}"))?;

    #[derive(Serialize)]
    struct BestMatch {
        line_idx: usize,
        payment_idx: Option<usize>,
        score: f64,
        reasons: Vec<String>,
        difference: f64,
    }

    let mut results = Vec::with_capacity(lines.len());

    for (li, line) in lines.iter().enumerate() {
        let mut best_score = 0.0_f64;
        let mut best: Option<SingleScoreOutput> = None;

        for (pi, payment) in payments.iter().enumerate() {
            let score = calculate_single_score(line, payment, &settings);
            if score.score > best_score {
                best_score = score.score;
                let mut s = score;
                s.line_idx = li;
                s.payment_idx = pi;
                best = Some(s);
            }
        }

        if let Some(best_score_data) = best {
            if best_score_data.score >= threshold {
                results.push(BestMatch {
                    line_idx: best_score_data.line_idx,
                    payment_idx: Some(best_score_data.payment_idx),
                    score: best_score_data.score,
                    reasons: best_score_data.reasons,
                    difference: best_score_data.difference,
                });
                continue;
            }
        }

        results.push(BestMatch {
            line_idx: li,
            payment_idx: None,
            score: 0.0,
            reasons: vec![],
            difference: 0.0,
        });
    }

    serde_json::to_string(&results).map_err(|e| format!("serialize output: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_date_iso() {
        let d = parse_date("2024-01-15");
        assert!(d.is_some());
        assert_eq!(d.unwrap(), NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());
    }

    #[test]
    fn test_amount_exact_match() {
        let (score, reasons) = compute_amount_score(1000.0, 1000.0);
        assert!((score - 100.0).abs() < f64::EPSILON);
        assert!(reasons.contains(&"exact_amount"));
    }

    #[test]
    fn test_amount_similar_match() {
        let (score, reasons) = compute_amount_score(1050.0, 1000.0);
        assert!((score - 50.0).abs() < f64::EPSILON);
        assert!(reasons.contains(&"similar_amount"));
    }

    #[test]
    fn test_amount_no_match() {
        let (score, reasons) = compute_amount_score(2000.0, 1000.0);
        assert!((score - 0.0).abs() < f64::EPSILON);
        assert!(reasons.is_empty());
    }

    #[test]
    fn test_date_exact_match() {
        let (score, reasons) = compute_date_score("2024-01-15", "2024-01-15");
        assert!((score - 100.0).abs() < f64::EPSILON);
        assert!(reasons.contains(&"exact_date"));
    }

    #[test]
    fn test_reference_exact_match() {
        let (score, reasons) =
            compute_reference_score(Some("REF001"), None, Some("REF001"));
        assert!((score - 100.0).abs() < f64::EPSILON);
        assert!(reasons.contains(&"exact_id_match"));
    }

    #[test]
    fn test_contact_fuzzy_match() {
        let (score, reasons) = compute_contact_score(
            Some("COMERCIAL ANDES"),
            Some("TEF/COMERCIAL ANDES SPA"),
            Some("BANCO_CHILE_CSV"),
        );
        assert!(score >= 70.0);
        assert!(!reasons.is_empty());
    }

    #[test]
    fn test_batch_match_scores() {
        let lines = r#"[{"id":1,"credit":1000.0,"debit":0.0,"transactionDate":"2024-01-15","transactionId":"REF001","reference":null,"description":"TEF/COMERCIAL ANDES SPA","bankFormat":"BANCO_CHILE_CSV"}]"#;
        let payments = r#"[{"id":1,"amount":1000.0,"date":"2024-01-15","transactionNumber":"REF001","contactName":"COMERCIAL ANDES"}]"#;
        let settings = r#"{"amountWeight":35.0,"dateWeight":25.0,"referenceWeight":25.0,"contactWeight":15.0}"#;

        let result = batch_match_scores(lines, payments, settings).unwrap();
        let scores: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(scores.len(), 1);
        assert!(scores[0]["score"].as_f64().unwrap() >= 90.0);
        assert_eq!(scores[0]["lineIdx"].as_i64().unwrap(), 0);
        assert_eq!(scores[0]["paymentIdx"].as_i64().unwrap(), 0);
    }

    #[test]
    fn test_best_match_per_line() {
        let lines = r#"[{"id":1,"credit":1000.0,"debit":0.0,"transactionDate":"2024-01-15","transactionId":"REF001","reference":null,"description":"TEF/COMERCIAL ANDES SPA","bankFormat":"BANCO_CHILE_CSV"},{"id":2,"credit":500.0,"debit":0.0,"transactionDate":"2024-01-20","transactionId":"REF002","reference":null,"description":"PAGO SUMINISTROS SPA","bankFormat":"BANCO_CHILE_CSV"}]"#;
        let payments = r#"[{"id":10,"amount":1000.0,"date":"2024-01-15","transactionNumber":"REF001","contactName":"COMERCIAL ANDES"},{"id":20,"amount":500.0,"date":"2024-01-20","transactionNumber":"REF002","contactName":"SUMINISTROS"}]"#;
        let settings = r#"{"amountWeight":35.0,"dateWeight":25.0,"referenceWeight":25.0,"contactWeight":15.0}"#;

        let result = best_match_per_line(lines, payments, settings, 40.0).unwrap();
        let best: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(best.len(), 2);
        assert!(best[0]["payment_idx"].as_i64().is_some());
        assert!(best[1]["payment_idx"].as_i64().is_some());
    }
}
