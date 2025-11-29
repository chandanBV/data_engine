#!/usr/bin/env python3
"""
Create test Parquet files with different compression formats
for testing the WASM Data Engine
"""

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import os

def create_sample_data(num_rows=1000):
    """Create sample dataset"""
    return pd.DataFrame({
        'id': range(1, num_rows + 1),
        'name': [f'User_{i}' for i in range(1, num_rows + 1)],
        'age': [20 + (i % 50) for i in range(1, num_rows + 1)],
        'department': [['Sales', 'Engineering', 'Marketing', 'HR'][i % 4] for i in range(num_rows)],
        'salary': [30000 + (i * 100) for i in range(1, num_rows + 1)],
        'active': [i % 2 == 0 for i in range(num_rows)]
    })

def main():
    # Create output directory
    output_dir = '../sample_data'
    os.makedirs(output_dir, exist_ok=True)
    
    print("Creating sample Parquet files...")
    
    # Create different sized datasets
    sizes = {
        'small': 100,
        'medium': 1000,
        'large': 10000
    }
    
    for size_name, num_rows in sizes.items():
        print(f"\nCreating {size_name} dataset ({num_rows} rows)...")
        df = create_sample_data(num_rows)
        
        # Convert to Arrow Table
        table = pa.Table.from_pandas(df)
        
        # 1. Uncompressed (WASM-compatible)
        filename = f'{output_dir}/test_{size_name}_uncompressed.parquet'
        pq.write_table(table, filename, compression='NONE')
        size_mb = os.path.getsize(filename) / (1024 * 1024)
        print(f"  ✅ Uncompressed: {filename} ({size_mb:.2f} MB)")
        
        # 2. Snappy (WASM-compatible)
        filename = f'{output_dir}/test_{size_name}_snappy.parquet'
        pq.write_table(table, filename, compression='SNAPPY')
        size_mb = os.path.getsize(filename) / (1024 * 1024)
        print(f"  ✅ Snappy: {filename} ({size_mb:.2f} MB)")
        
        # 3. GZIP (NOT WASM-compatible - for testing error handling)
        filename = f'{output_dir}/test_{size_name}_gzip.parquet'
        pq.write_table(table, filename, compression='GZIP')
        size_mb = os.path.getsize(filename) / (1024 * 1024)
        print(f"  ❌ GZIP (not supported): {filename} ({size_mb:.2f} MB)")
    
    print("\n" + "="*60)
    print("Test files created successfully!")
    print("="*60)
    print("\nFiles you can upload to the WASM Data Engine:")
    print("  ✅ *_uncompressed.parquet - Will work")
    print("  ✅ *_snappy.parquet - Will work")
    print("  ❌ *_gzip.parquet - Will fail with helpful error message")
    print("\nRecommendation: Use Snappy compression for best balance")
    print(f"Output directory: {os.path.abspath(output_dir)}")

if __name__ == '__main__':
    try:
        import pandas
        import pyarrow
        main()
    except ImportError as e:
        print("Error: Required packages not installed")
        print("\nPlease install required packages:")
        print("  pip install pandas pyarrow")
        print(f"\nMissing: {e}")
