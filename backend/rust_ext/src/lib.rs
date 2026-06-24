pub mod matching;

use pyo3::prelude::*;

/// Compute match scores for all line-payment pairs in batch.
///
/// Args:
///     lines_json: JSON string array of line data objects.
///     payments_json: JSON string array of payment data objects.
///     settings_json: JSON string of settings object.
///
/// Returns:
///     JSON string array of score objects sorted by (line_idx, payment_idx).
#[pyfunction]
fn batch_match_scores(
    lines_json: &str,
    payments_json: &str,
    settings_json: &str,
) -> PyResult<String> {
    matching::score::batch_match_scores(lines_json, payments_json, settings_json)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e))
}

/// For each line, find the best-scoring payment above a threshold.
///
/// Args:
///     lines_json: JSON string array of line data objects.
///     payments_json: JSON string array of payment data objects.
///     settings_json: JSON string of settings object.
///     threshold: minimum score (0-100) to consider a match valid.
///
/// Returns:
///     JSON string array, one entry per line. Each entry has:
///         line_idx, payment_idx (or null), score, reasons, difference.
#[pyfunction]
fn best_match_per_line(
    lines_json: &str,
    payments_json: &str,
    settings_json: &str,
    threshold: f64,
) -> PyResult<String> {
    matching::score::best_match_per_line(lines_json, payments_json, settings_json, threshold)
        .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e))
}

/// Normalize a bank statement description.
#[pyfunction]
fn normalize_description(text: &str, bank_format: Option<&str>) -> String {
    matching::normalize::normalize_description(text, bank_format)
}

/// A Python module implemented in Rust for ERPGrafico performance-critical
/// computations: bank reconciliation matching, description normalization, etc.
#[pymodule]
fn erpgrafico_rs(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(batch_match_scores, m)?)?;
    m.add_function(wrap_pyfunction!(best_match_per_line, m)?)?;
    m.add_function(wrap_pyfunction!(normalize_description, m)?)?;
    Ok(())
}
