use arrow::{array::RecordBatch, ipc::writer::StreamWriter};
use std::io::Cursor;

pub fn batches_to_ipc(batches: &Vec<RecordBatch>) -> Vec<u8> {
    let mut cursor = Cursor::new(Vec::new());
    let schema = batches[0].schema();

    let mut writer = StreamWriter::try_new(&mut cursor, &schema).unwrap();

    for batch in batches {
        writer.write(&batch).unwrap();
    }

    writer.finish().unwrap();

    cursor.into_inner()
}
