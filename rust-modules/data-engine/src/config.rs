use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PivotConfig {
    pub row_fields: Vec<String>,
    pub column_fields: Vec<String>,
    pub value_fields: Vec<String>,
    pub aggregation_type: String, // "sum", "avg", "min", "max", "count"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregateConfig {
    pub group_by_fields: Vec<String>,
    pub aggregations: Vec<AggregationSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregationSpec {
    pub field: String,
    pub operation: String, // "sum", "avg", "min", "max", "count"
    pub alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterConfig {
    pub filters: Vec<FilterSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterSpec {
    pub field: String,
    pub filter_type: String, // "equals", "contains", "range", "date_range"
    pub value: Option<String>,
    pub min_value: Option<String>,
    pub max_value: Option<String>,
}
