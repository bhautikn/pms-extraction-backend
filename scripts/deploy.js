const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple parser for .env file since we are in commonjs and don't want to require dotenv if not installed globally for the script
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
          value = value.replace(/^"|"$/g, '');
        }
        process.env[key] = value;
      }
    });
  }
}

function runCommand(command) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (error) {
    console.error(`❌ Command failed with exit code ${error.status}`);
    process.exit(1);
  }
}

function deploy() {
  console.log('🚀 Starting Azure Functions Deployment...');
  
  loadEnv();

  const appName = process.env.AZURE_FUNCTION_APP_NAME;

  if (!appName || appName === 'YOUR_FUNCTION_APP_NAME') {
    console.error('❌ Error: AZURE_FUNCTION_APP_NAME is not set or is still the default in your .env file.');
    console.error('👉 Please create a Function App in Azure and add its name to your backend/.env file:');
    console.error('   AZURE_FUNCTION_APP_NAME=my-extractmate-backend');
    process.exit(1);
  }

  try {
    // 1. Build the TypeScript code
    console.log('\n📦 Step 1: Building project...');
    runCommand('npm run build:tsc');

    // Ensure config files are copied to dist
    console.log('\n📂 Copying non-TS assets to dist...');
    fs.mkdirSync(path.join(__dirname, '../dist/config'), { recursive: true });
    if (fs.existsSync(path.join(__dirname, '../src/config/system-prompt.md'))) {
      fs.copyFileSync(
        path.join(__dirname, '../src/config/system-prompt.md'),
        path.join(__dirname, '../dist/config/system-prompt.md')
      );
    }

    // 2. Publish using Azure Functions Core Tools with remote build
    console.log(`\n☁️ Step 2: Publishing to Azure Function App: ${appName} (Remote Build)...`);
    // Note: The user must be logged in via `az login`
    runCommand(`npx func azure functionapp publish ${appName} --build remote`);

    console.log('\n✅ Deployment successful!');
  } catch (err) {
    console.error('\n❌ Deployment failed unexpectedly:', err.message);
    process.exit(1);
  }
}

deploy();
