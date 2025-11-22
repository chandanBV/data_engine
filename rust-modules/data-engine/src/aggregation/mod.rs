use arrow::array::{Float64Array, RecordBatch};
use arrow::compute::kernels::aggregate::{max, min, sum};

pub enum AggOp {
    Sum,
    Min,
    Max,
    Count,
}

pub struct Aggregation<'a> {
    pub data: &'a [RecordBatch],
}

impl<'a> Aggregation<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn execute(&self, col_name: &str, op: AggOp) -> Result<f64, String> {
        let col_idx = self.data[0].column_by_name(col_name).unwrap();
        let col = col_idx.as_any().downcast_ref::<Float64Array>().unwrap();
        let res = match op {
            AggOp::Sum => sum(col).unwrap(),
            AggOp::Min => min(col).unwrap(),
            AggOp::Max => max(col).unwrap(),
            AggOp::Count => col.len() as f64,
        };
        Ok(res)
    }
}
