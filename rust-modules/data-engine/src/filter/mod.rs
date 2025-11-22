use arrow::array::{Float64Array, RecordBatch};
use arrow::compute::filter;
use arrow::compute::kernels::filter::{FilterBuilder, FilterPredicate};

pub struct Filter<'a> {
    data: &'a Vec<RecordBatch>,
}

impl<'a> Filter<'a> {
    pub fn new(data: &'a Vec<RecordBatch>) -> Self {
        Self { data }
    }

    pub fn filter(&self, col_name: String) -> Result<f64, String> {
        let col_idx = self.data[0].column_by_name(&col_name).unwrap();
        let col = col_idx.as_any().downcast_ref::<Float64Array>().unwrap();
        // let res = filter(col, FilterPredicate::filter(&self, values)).unwrap();
        Ok(0.0)
    }
}
