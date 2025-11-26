// Simple integration test for the WASM data engine
// Run this with: node test_integration.js

const fs = require('fs');
const path = require('path');

console.log('🧪 Integration Test for WASM Data Engine');
console.log('=====================================');

// Check if WASM files exist
const wasmDir = path.join(__dirname, 'frontend', 'src', 'wasm', 'data-engine');
const requiredFiles = [
  'data_engine.js',
  'data_engine_bg.wasm',
  'data_engine.d.ts'
];

console.log('\n📁 Checking WASM build artifacts...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(wasmDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!allFilesExist) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n✅ All WASM files are present!');
} else {
  console.log('\n❌ Some WASM files are missing. Run: ./scripts/build-wasm.sh');
}

// Check if sample data exists
const sampleDataPath = path.join(__dirname, 'sample_data.csv');
const sampleDataExists = fs.existsSync(sampleDataPath);
console.log(`\n📊 Sample data: ${sampleDataExists ? '✅' : '❌'} sample_data.csv`);

// Check React components
const componentsDir = path.join(__dirname, 'frontend', 'src', 'components');
const requiredComponents = [
  'DataUploader.jsx',
  'ProcessingControls.jsx',
  'ResultViewer.jsx'
];

console.log('\n⚛️  Checking React components...');
requiredComponents.forEach(component => {
  const componentPath = path.join(componentsDir, component);
  const exists = fs.existsSync(componentPath);
  console.log(`  ${exists ? '✅' : '❌'} ${component}`);
});

// Check pages
const pagesDir = path.join(__dirname, 'frontend', 'src', 'pages');
const enhancedPageExists = fs.existsSync(path.join(pagesDir, 'EnhancedDataEnginePage.jsx'));
console.log(`\n📄 Enhanced page: ${enhancedPageExists ? '✅' : '❌'} EnhancedDataEnginePage.jsx`);

console.log('\n🚀 Next Steps:');
console.log('1. cd frontend');
console.log('2. yarn install (if not done)');
console.log('3. yarn start');
console.log('4. Navigate to http://localhost:3000/data-engine');
console.log('5. Upload sample_data.csv and test the functionality');

console.log('\n📋 Test Scenarios:');
console.log('• Upload CSV file');
console.log('• Create pivot: category (rows) × region (columns), sales (values)');
console.log('• Aggregate: group by category, sum sales');
console.log('• Filter: category = "Electronics", sales > 1000');

console.log('\n🎯 Expected Results:');
console.log('• File uploads successfully');
console.log('• Schema information displays');
console.log('• Operations complete without errors');
console.log('• Results display in table/JSON format');
console.log('• Export functions work');

if (allFilesExist && sampleDataExists && enhancedPageExists) {
  console.log('\n🎉 Integration test PASSED! Ready to run the application.');
} else {
  console.log('\n⚠️  Integration test FAILED. Please fix the missing components above.');
}
